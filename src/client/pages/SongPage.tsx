import { Alert, Button, Center, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import type { SongLinkState } from '../components/SongRow.tsx';
import { parseSong } from '#shared/chordpro/parse.ts';
import { PlaylistPill } from '../components/PlaylistPill.tsx';
import { putPlaylist, useCatalog } from '../data/catalog.ts';
import { transposeKey } from '#shared/chordpro/chord.ts';
import {
  nearest,
  semitonesFor,
  songPitch,
  transposeSong,
} from '#shared/chordpro/transpose.ts';
import { editsAsMember } from '#shared/roles.ts';
import { usePinnedTranspose, usePrefs } from '../data/prefs.ts';
import { playPlaylist, songPlayed, usePlayer } from '../data/session.ts';
import type { PlaylistRecord, SongRecord } from '../data/store.ts';
import { isPlainTap, useHideOnScroll } from '../hooks/useHideOnScroll.ts';
import { useKeys } from '../hooks/useKeys.ts';
import { useMe } from '../hooks/useMe.ts';
import { useOnline } from '../hooks/useOnline.ts';
import { usePinch } from '../hooks/usePinch.ts';
import { useSwipe } from '../hooks/useSwipe.ts';
import { useWakeLock } from '../hooks/useWakeLock.ts';
import { useI18n } from '../i18n/index.tsx';
import { SongSheet } from '../song/SongSheet.tsx';
import { SongStatusBanner } from '../song/SongStatusBanner.tsx';
import { SongToolbar } from '../song/SongToolbar.tsx';
import { PlaylistBar } from '../song/PlaylistBar.tsx';
import { trpc } from '../trpc.ts';
import { idFromRef, url } from '#shared/urls.ts';
import { followSong, playlistSteps } from '../song/followSong.ts';
import { useCanonicalPath } from '../hooks/useCanonicalPath.ts';
import classes from './SongPage.module.css';
import { PageLoader } from '../components/PageLoader.tsx';
import { canChangeSong, canDeleteSong, isEditor } from '#shared/songs.ts';

/** /song/:songRef: one song on its own. */
export function SongPage() {
  const { songRef } = useParams();
  const id = idFromRef(songRef);
  return <SongPlayer songId={id} playlist={null} />;
}

/** /playlist/:playlistRef/:position: a song inside a playlist, with previous and next. */
export function PlaylistSongPage() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const playlistId = idFromRef(params.playlistRef) ?? 0;
  const position = Number(params.position);
  const { playlists, loaded } = useCatalog();
  const playlist = playlists.get(playlistId);
  const { t } = useI18n();

  // The song being played, remembered apart from its position: when someone else changes the
  // playlist, the player stays on this song (D68). A visit to a position (prev, next, a link)
  // starts over from whatever is there; a correction made here keeps the song.
  const songAt = playlist?.songIds[position - 1] ?? null;
  const [shown, setShown] = useState<{ key: string; songId: number | null } | null>(null);
  let current = shown;
  if (
    !current ||
    current.key !== location.key ||
    (current.songId === null && songAt !== null)
  ) {
    const followed = (location.state as { followSong?: number } | null)?.followSong;
    current = { key: location.key, songId: followed ?? songAt };
    setShown(current);
  }
  const songId = current.songId;
  const followed =
    playlist && songId !== null ? followSong(playlist.songIds, songId, position) : null;
  useEffect(() => {
    if (playlist && songId !== null && followed && followed.position !== position) {
      navigate(url.playlistSong(playlist, followed.position), {
        replace: true,
        state: { followSong: songId },
      });
    }
  }, [playlist, songId, followed, position, navigate]);

  useEffect(() => {
    if (playlist && position >= 1 && position <= playlist.songIds.length) {
      playPlaylist(playlist.id, position);
    }
  }, [playlist, position]);
  useCanonicalPath(playlist ? url.playlistSong(playlist, position) : null);

  if (!loaded) {
    return <PageLoader full />;
  }
  if (!playlist) {
    return (
      <Missing
        text={navigator.onLine ? t('playlists.notFound') : t('playlists.notOnDevice')}
      />
    );
  }
  return (
    <SongPlayer
      songId={songId}
      playlist={{
        id: playlist.id,
        name: playlist.name,
        songIds: playlist.songIds,
        songKeys: playlist.songKeys,
        role: playlist.role,
        position,
        removed: followed?.removed ?? false,
      }}
    />
  );
}

type PlaylistContext = {
  id: number;
  name: string;
  songIds: number[];
  /** The keys the playlist plays its songs in, where not their own (D131). */
  songKeys: PlaylistRecord['songKeys'];
  role: PlaylistRecord['role'];
  position: number;
  /** Someone took the song out while it played: it stays, and next is the song after it. */
  removed: boolean;
};

/**
 * Finds the song in the catalog; failing that (a song the device hasn't synced yet), asks the
 * server. Offline there is no one to ask: `offline` says why it isn't here.
 */
function useSong(songId: number | null) {
  const { songs, loaded, synced } = useCatalog();
  const online = useOnline();
  const fromCatalog = songId === null ? undefined : songs.get(songId);
  const fallback = trpc.songs.byId.useQuery(
    { id: songId ?? 0 },
    { enabled: songId !== null && loaded && synced && !fromCatalog, retry: false },
  );
  const song: SongRecord | undefined = fromCatalog ?? fallback.data;
  const pending = !loaded || (!fromCatalog && online && (!synced || fallback.isLoading));
  return { song, pending, offline: !online && !song };
}

function SongPlayer({
  songId,
  playlist,
}: {
  songId: number | null;
  playlist: PlaylistContext | null;
}) {
  const { t, tError } = useI18n();
  const navigate = useNavigate();
  const { song, pending, offline } = useSong(songId);
  const { session } = usePlayer();
  const prefs = usePrefs();
  const { me } = useMe();
  useWakeLock();
  const back = useBack(playlist);
  const toolbar = useHideOnScroll();
  useCanonicalPath(!playlist && song ? url.song(song) : null);

  const parsed = useMemo(() => (song ? parseSong(song.source) : null), [song]);
  const pitch = parsed ? songPitch(parsed) : null;
  usePinnedTranspose(song?.id ?? null, pitch);
  // Where it starts: the playlist's key (D131), else the song's own. The player's own shift,
  // kept on this device, goes on top of either, relative to the song's text.
  const base = playlist && song ? semitonesFor(playlist.songKeys[song.id], pitch) : 0;
  const own = song ? semitonesFor(prefs.transpose[song.id], pitch) : 0;
  const semitones = nearest(base + own);
  const baseKey =
    parsed?.meta.key && base !== 0
      ? transposeKey(parsed.meta.key, base, parsed.noteSystem)
      : (parsed?.meta.key ?? null);
  const setSongKey = trpc.playlists.setSongKey.useMutation();
  const shown = useMemo(
    () => (parsed ? transposeSong(parsed, semitones) : null),
    [parsed, semitones],
  );

  useEffect(() => {
    if (song) {
      songPlayed(song.id);
      document.title = `${song.title} · ${t('app.name')}`;
    }
    return () => {
      document.title = t('app.name');
    };
  }, [song, t]);

  // Scroll back to the top on every new song: the next song starts at its title.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [songId]);

  const total = playlist?.songIds.length ?? 0;
  // Built from primitives: the playlist object is new on every render, and these feed the
  // swipe and key listeners, which would otherwise re-attach on each one.
  const playlistId = playlist?.id ?? null;
  const playlistName = playlist?.name ?? '';
  const steps = playlist
    ? playlistSteps(playlist.songIds, playlist.position, playlist.removed)
    : null;
  const prevPosition = steps?.prev ?? null;
  const nextPosition = steps?.next ?? null;
  const { prev, next } = useMemo(() => {
    if (playlistId === null) {
      return { prev: undefined, next: undefined };
    }
    const go = (to: number | null) =>
      to === null
        ? undefined
        : () =>
            navigate(url.playlistSong({ id: playlistId, name: playlistName }, to), {
              replace: true,
            });
    return { prev: go(prevPosition), next: go(nextPosition) };
  }, [navigate, playlistId, playlistName, prevPosition, nextPosition]);

  useSwipe(useMemo(() => ({ onLeft: next, onRight: prev }), [next, prev]));
  usePinch(prefs.fontScale, prefs.setFontScale);
  useKeys(
    useMemo(
      () => ({
        ArrowRight: next,
        ArrowLeft: prev,
        // A page-turner pedal: scroll a screenful, and at the end of the song turn the page.
        PageDown: () => {
          const atEnd =
            window.innerHeight + window.scrollY >=
            document.documentElement.scrollHeight - 4;
          if (atEnd) {
            next?.();
          } else {
            window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
          }
        },
        PageUp: () => {
          if (window.scrollY <= 4) {
            prev?.();
          } else {
            window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
          }
        },
        Escape: () => navigate(back.to),
      }),
      [next, prev, navigate, back.to],
    ),
  );

  if (pending) {
    return <PageLoader full />;
  }
  if (!song || !shown) {
    return <Missing text={offline ? t('song.notOnDevice') : t('song.notFound')} />;
  }

  const canEdit = canChangeSong(me, song);
  // Jumped out of a playlist to play something else: keep the way back in reach.
  const showPill = !playlist && session !== null;

  return (
    <div
      className={classes.page}
      data-bottom-bar={playlist || showPill ? true : undefined}
    >
      <SongToolbar
        backTo={back.to}
        backLabel={back.label}
        song={song}
        shownKey={shown.meta.key}
        baseKey={baseKey}
        semitones={semitones}
        own={own}
        pitch={pitch}
        playlist={
          playlist
            ? {
                name: playlist.name,
                hasKey: base !== 0,
                canSetKey: editsAsMember(playlist.role) && Boolean(me?.emailVerified),
                setKey: (shift: number) =>
                  setSongKey.mutate(
                    { id: playlist.id, songId: song.id, semitones: shift, from: pitch },
                    {
                      onSuccess: (record) => {
                        putPlaylist(record.id, record);
                        // It plays there from the playlist's key now: nothing left of one's own.
                        prefs.setTranspose(song.id, 0, pitch);
                        notifications.show({
                          message:
                            shift === 0
                              ? t('song.playlistKeyCleared', { name: playlist.name })
                              : shown.meta.key
                                ? t('song.playlistKeySet', {
                                    name: playlist.name,
                                    key: shown.meta.key,
                                  })
                                : t('song.playlistShiftSet', { name: playlist.name }),
                        });
                      },
                      onError: (error) =>
                        notifications.show({ color: 'red', message: tError(error) }),
                    },
                  ),
              }
            : null
        }
        hasDiagrams={(parsed?.definitions.length ?? 0) > 0}
        canEdit={canEdit}
        canDelete={canDeleteSong(me, song)}
        canAddToPlaylist={Boolean(me?.emailVerified)}
        hidden={toolbar.hidden}
      />
      <SongStatusBanner
        song={song}
        fixTo={canEdit ? url.editSong(song.id) : undefined}
        reviewTo={isEditor(me) ? url.review(song.id) : undefined}
      />
      {/* A tap on the song hides the toolbar and the playlist bar, or brings them back, when
          things get tight (D93, D109).
          A pointer convenience on top of scrolling, which does the same, so no key of its own. */}
      <div
        onClick={(e) => {
          if (isPlainTap(e.target)) {
            toolbar.toggle();
          }
        }}
      >
        <SongSheet
          song={shown}
          fontScale={prefs.fontScale}
          showDiagrams={prefs.showDiagrams && semitones === 0}
          showColumns={prefs.showColumns}
          showChords={prefs.showChords}
          isPrivate={song.status === 'private'}
        />
      </div>
      {playlist?.removed && (
        <Alert mx="md" mt="xs">
          {t('song.removedFromPlaylist')}
        </Alert>
      )}
      {playlist && (
        <PlaylistBar
          name={playlist.name}
          position={playlist.position}
          total={total}
          nextSongId={steps?.nextSongId ?? undefined}
          onPrev={prev}
          onNext={next}
          hidden={toolbar.hidden}
        />
      )}
      {showPill && <PlaylistPill />}
    </div>
  );
}

/**
 * Where the song's back arrow leads: one level up (D60). Inside a playlist being played, the
 * playlist; otherwise the overview, keeping the search the song was found by, or the tag's
 * songs it was picked from (D118). "Where I came
 * from" is the browser's own back, not this arrow's.
 */
function useBack(playlist: PlaylistContext | null) {
  const { t } = useI18n();
  const location = useLocation();
  if (playlist) {
    return {
      to: url.playlist(playlist),
      label: t('nav.backTo', { name: playlist.name }),
    };
  }
  const state = location.state as SongLinkState | null;
  if (state?.backTo) {
    return {
      to: state.backTo,
      label: state.backName
        ? t('nav.backTo', { name: state.backName })
        : t('nav.backToResults'),
    };
  }
  return { to: url.home(), label: t('nav.backHome') };
}

/**
 * A song or playlist that isn't here for the viewer. Gone, or private and not theirs: one text
 * for both, so nothing says a private one exists. Signed out, signing in is the likely way in,
 * and comes back here.
 */
function Missing({ text }: { text: string }) {
  const { t } = useI18n();
  const { me, known } = useMe();
  const location = useLocation();
  const signedOut = known && !me;
  return (
    <Center h="100dvh" p="md">
      <Stack align="center">
        <Text ta="center">{text}</Text>
        <Group justify="center" gap="sm">
          {signedOut && (
            <Button component={Link} to={url.logIn(location.pathname + location.search)}>
              {t('auth.logIn')}
            </Button>
          )}
          <Button
            component={Link}
            to={url.home()}
            variant={signedOut ? 'default' : undefined}
          >
            {t('notFound.home')}
          </Button>
        </Group>
      </Stack>
    </Center>
  );
}
