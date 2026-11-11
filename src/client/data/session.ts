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
  writeLocalJson('session', session);
  update({ session, recentPlaylists: touched(playlistId) });
}

/**
 * A playlist this device just made or joined: among the recent ones on the overview straight
 * away, as if played (D33), so it is one tap away when the evening starts.
 */
export function touchPlaylist(playlistId: number) {
  update({ recentPlaylists: touched(playlistId) });
}

function touched(playlistId: number): Record<number, number> {
  const recentPlaylists = { ...state.recentPlaylists, [playlistId]: Date.now() };
  writeLocalJson('recentPlaylists', recentPlaylists);
  return recentPlaylists;
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
