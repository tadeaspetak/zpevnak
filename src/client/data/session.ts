/**
 * Where the player is: the playlist being played (if any), and what was played recently.
 * Per device, in localStorage, so it works offline and signed out.
 */
import { useSyncExternalStore } from 'react';
import { readLocalJson, writeLocalJson } from './local.ts';

type PlaylistSession = { playlistId: number; position: number };

type State = {
  session: PlaylistSession | null;
  /** Playlist id → when it was last played (ms). */
  recentPlaylists: Record<number, number>;
  /** Song ids, most recent first. */
  recentSongs: number[];
};

const RECENT_SONGS = 12;

let state: State = {
  session: readLocalJson<PlaylistSession | null>('session', null),
  recentPlaylists: readLocalJson<Record<number, number>>('recentPlaylists', {}),
  recentSongs: readLocalJson<number[]>('recentSongs', []),
};
const listeners = new Set<() => void>();

function update(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function playPlaylist(playlistId: number, position: number) {
  if (state.session?.playlistId === playlistId && state.session.position === position) {
    return;
  }
  const session = { playlistId, position };
  const recentPlaylists = { ...state.recentPlaylists, [playlistId]: Date.now() };
  writeLocalJson('session', session);
  writeLocalJson('recentPlaylists', recentPlaylists);
  update({ session, recentPlaylists });
}

export function leavePlaylist() {
  writeLocalJson('session', null);
  update({ session: null });
}

export function songPlayed(songId: number) {
  if (state.recentSongs[0] === songId) {
    return;
  }
  const recentSongs = [songId, ...state.recentSongs.filter((id) => id !== songId)].slice(
    0,
    RECENT_SONGS,
  );
  writeLocalJson('recentSongs', recentSongs);
  update({ recentSongs });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePlayer(): State {
  return useSyncExternalStore(subscribe, () => state);
}
