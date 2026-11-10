import { Alert, Button, Loader, Center, Stack, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import type { SongLinkState } from '../components/SongRow.tsx';
import { parseSong } from '#shared/chordpro/parse.ts';
import { transposeSong } from '#shared/chordpro/transpose.ts';
import { PlaylistPill } from '../components/PlaylistPill.tsx';
import { useCatalog } from '../data/catalog.ts';
import { usePrefs } from '../data/prefs.ts';
import { playPlaylist, songPlayed, usePlayer } from '../data/session.ts';
import type { SongRecord } from '../data/store.ts';
import { useKeys } from '../hooks/useKeys.ts';
import { useMe } from '../hooks/useMe.ts';
import { useSwipe } from '../hooks/useSwipe.ts';
import { useWakeLock } from '../hooks/useWakeLock.ts';
import { useI18n } from '../i18n/index.tsx';
import { SongSheet } from '../song/SongSheet.tsx';
import { SongStatusBanner } from '../song/SongStatusBanner.tsx';
import { SongToolbar } from '../song/SongToolbar.tsx';
import { PlaylistBar } from '../song/PlaylistBar.tsx';
import { trpc } from '../trpc.ts';
import { idFromRef, url } from '../urls.ts';
import { followSong, playlistSteps } from '../song/followSong.ts';
import { useCanonicalPath } from '../hooks/useCanonicalPath.ts';
import classes from './SongPage.module.css';

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
    return <FullPageLoader />;
  }
  if (!playlist) {
    return <Missing text={t('playlists.notFound')} />;
  }
  return (
    <SongPlayer
      songId={songId}
      playlist={{
        id: playlist.id,
        name: playlist.name,
        songIds: playlist.songIds,
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
  position: number;
  /** Someone took the song out while it played: it stays, and next is the song after it. */
  removed: boolean;
};

/** Finds the song in the catalog; failing that (a rejected song an editor opens), asks the server. */
function useSong(songId: number | null) {
  const { songs, loaded, synced } = useCatalog();
  const fromCatalog = songId === null ? undefined : songs.get(songId);
  const fallback = trpc.songs.byId.useQuery(
    { id: songId ?? 0 },
    { enabled: songId !== null && loaded && synced && !fromCatalog, retry: false },
  );
  const song: SongRecord | undefined = fromCatalog ?? fallback.data;
  const pending = !loaded || (!fromCatalog && (!synced || fallback.isLoading));
  return { song, pending };
}

function SongPlayer({
  songId,
  playlist,
}: {
  songId: number | null;
  playlist: PlaylistContext | null;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { song, pending } = useSong(songId);
  const { session } = usePlayer();
  const prefs = usePrefs();
  const { me, isEditor } = useMe();
  useWakeLock();
  const back = useBack(playlist);
  useCanonicalPath(!playlist && song ? url.song(song) : null);

  const semitones = song ? (prefs.transpose[song.id] ?? 0) : 0;
  const parsed = useMemo(() => (song ? parseSong(song.source) : null), [song]);
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
    return <FullPageLoader />;
  }
  if (!song || !shown) {
    return <Missing text={t('song.notFound')} />;
  }

  const canEdit =
    me?.emailVerified &&
    (isEditor || (song.createdBy === me.id && song.status !== 'verified'));
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
        originalKey={parsed?.meta.key ?? null}
        shownKey={shown.meta.key}
        semitones={semitones}
        hasDiagrams={(parsed?.definitions.length ?? 0) > 0}
        hasColumns={(parsed?.columns ?? 1) > 1}
        canEdit={Boolean(canEdit)}
        canAddToPlaylist={Boolean(me?.emailVerified)}
      />
      <SongStatusBanner song={song} />
      <SongSheet
        song={shown}
        fontScale={prefs.fontScale}
        showDiagrams={prefs.showDiagrams && semitones === 0}
        showColumns={prefs.showColumns}
        showChords={prefs.showChords}
      />
      {playlist?.removed && (
        <Alert color="gray" variant="light" mx="md" mt="xs">
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
        />
      )}
      {showPill && <PlaylistPill />}
    </div>
  );
}

/**
 * Where the song's back arrow leads: one level up (D60). Inside a playlist being played, the
 * playlist; otherwise the overview, keeping the search the song was found by. "Where I came
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
  const results = (location.state as SongLinkState | null)?.backTo;
  return results
    ? { to: results, label: t('nav.backToResults') }
    : { to: url.home(), label: t('nav.backHome') };
}

function FullPageLoader() {
  return (
    <Center h="100dvh">
      <Loader />
    </Center>
  );
}

function Missing({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <Center h="100dvh" p="md">
      <Stack align="center">
        <Text ta="center">{text}</Text>
        <Button component={Link} to={url.home()}>
          {t('notFound.home')}
        </Button>
      </Stack>
    </Center>
  );
}
