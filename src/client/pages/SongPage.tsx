import { Alert, Button, Loader, Center, Stack, Text } from '@mantine/core';
import { useEffect, useMemo } from 'react';
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
import { SongToolbar } from '../song/SongToolbar.tsx';
import { PlaylistBar } from '../song/PlaylistBar.tsx';
import { trpc } from '../trpc.ts';
import { songIdFromRef, url } from '../urls.ts';
import classes from './SongPage.module.css';

/** /s/:songRef: one song on its own. */
export function SongPage() {
  const { songRef } = useParams();
  const id = songIdFromRef(songRef);
  return <SongPlayer songId={id} playlist={null} />;
}

/** /p/:id/:position: a song inside a playlist, with previous and next. */
export function PlaylistSongPage() {
  const params = useParams();
  const playlistId = Number(params.id);
  const position = Number(params.position);
  const { playlists, loaded } = useCatalog();
  const playlist = playlists.get(playlistId);
  const { t } = useI18n();

  useEffect(() => {
    if (playlist && position >= 1 && position <= playlist.songIds.length) {
      playPlaylist(playlist.id, position);
    }
  }, [playlist, position]);

  if (!loaded) {
    return <FullPageLoader />;
  }
  if (!playlist) {
    return <Missing text={t('playlists.notFound')} />;
  }
  const songId = playlist.songIds[position - 1] ?? null;
  return (
    <SongPlayer
      songId={songId}
      playlist={{
        id: playlist.id,
        name: playlist.name,
        songIds: playlist.songIds,
        position,
      }}
    />
  );
}

type PlaylistContext = { id: number; name: string; songIds: number[]; position: number };

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
  const goTo = useMemo(
    () => (position: number) => {
      if (playlist && position >= 1 && position <= total) {
        navigate(url.playlistSong(playlist.id, position), { replace: true });
      }
    },
    [navigate, playlist, total],
  );
  const prev =
    playlist && playlist.position > 1 ? () => goTo(playlist.position - 1) : undefined;
  const next =
    playlist && playlist.position < total ? () => goTo(playlist.position + 1) : undefined;

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
  const nextSong = playlist ? playlist.songIds[playlist.position] : undefined;

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
        canEdit={Boolean(canEdit)}
        canAddToPlaylist={Boolean(me?.emailVerified)}
      />
      {song.status === 'rejected' && song.rejection && (
        <Alert
          color="red"
          variant="light"
          mx="md"
          mt="xs"
          title={t('song.rejectedNote', { reason: t(`reason.${song.rejection.reason}`) })}
        >
          {song.rejection.note && <Text size="sm">{song.rejection.note}</Text>}
          <Text size="sm">{t('song.rejectedFix')}</Text>
        </Alert>
      )}
      <SongSheet
        song={shown}
        fontScale={prefs.fontScale}
        showDiagrams={prefs.showDiagrams && semitones === 0}
      />
      {song.status === 'pending' && (
        <Text size="sm" c="dimmed" px="md" pb="md">
          {t('song.unverifiedNote')}
        </Text>
      )}
      {playlist && (
        <PlaylistBar
          name={playlist.name}
          position={playlist.position}
          total={total}
          nextSongId={nextSong}
          onPrev={prev}
          onNext={next}
        />
      )}
      {showPill && <PlaylistPill />}
    </div>
  );
}

/**
 * Where the song's back arrow leads, and what its tooltip says: the playlist when playing
 * one, else the page the song was opened from (search results keep their query), else home.
 */
function useBack(playlist: PlaylistContext | null) {
  const { t } = useI18n();
  const location = useLocation();
  if (playlist) {
    return {
      to: url.playlist(playlist.id),
      label: t('nav.backTo', { name: playlist.name }),
    };
  }
  const from = (location.state as SongLinkState | null)?.backTo;
  if (!from || from === url.home()) {
    return { to: url.home(), label: t('nav.backHome') };
  }
  if (new URLSearchParams(from.split('?')[1] ?? '').has('q') && from.startsWith('/?')) {
    return { to: from, label: t('nav.backToResults') };
  }
  if (from === url.account()) {
    return { to: from, label: t('nav.backTo', { name: t('account.title') }) };
  }
  return { to: from, label: t('common.back') };
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
        <Button component={Link} to={url.home()} variant="light">
          {t('notFound.home')}
        </Button>
      </Stack>
    </Center>
  );
}
