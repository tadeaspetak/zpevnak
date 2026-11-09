/**
 * The catalog in memory: songs and playlists, loaded from the device first and then kept
 * in step with the server. Components read it through `useCatalog`.
 */
import { useSyncExternalStore } from 'react';
import { trpcClient } from '../trpc.ts';
import {
  loadStored,
  storePlaylists,
  storeSongs,
  type PlaylistRecord,
  type SongRecord,
} from './store.ts';

export type Catalog = {
  songs: Map<number, SongRecord>;
  playlists: Map<number, PlaylistRecord>;
  /** The device copy has been read; the lists are as complete as this device knows. */
  loaded: boolean;
  /** At least one sync with the server has finished since the app opened. */
  synced: boolean;
  syncing: boolean;
};

let state: Catalog = {
  songs: new Map(),
  playlists: new Map(),
  loaded: false,
  synced: false,
  syncing: false,
};
let cursor: string | null = null;
let viewerId: number | null = null;
const listeners = new Set<() => void>();

/**
 * What components see: each playlist holding only the songs this device has. A deleted song
 * (D78) leaves the catalog before its playlists are fetched again; this keeps the count, the
 * list and the player in agreement meanwhile.
 */
function playable(raw: Catalog): Catalog {
  const playlists = new Map(
    [...raw.playlists].map(([id, p]) => [
      id,
      p.songIds.every((songId) => raw.songs.has(songId))
        ? p
        : { ...p, songIds: p.songIds.filter((songId) => raw.songs.has(songId)) },
    ]),
  );
  return { ...raw, playlists };
}

let view: Catalog = playable(state);

function update(patch: Partial<Catalog>) {
  state = { ...state, ...patch };
  view = playable(state);
  listeners.forEach((l) => l());
}

let loading: Promise<void> | null = null;

function loadFromDevice() {
  loading ??= loadStored().then((stored) => {
    cursor = stored.sync.cursor;
    viewerId = stored.sync.viewerId;
    update({
      songs: new Map(stored.songs.map((s) => [s.id, s])),
      playlists: new Map(stored.playlists.map((p) => [p.id, p])),
      loaded: true,
    });
  });
  return loading;
}

let running: Promise<void> | null = null;

/**
 * Brings the catalog up to date. `viewer` is who is signed in (null: nobody); when it
 * changes, the catalog is fetched whole, because each viewer sees different songs.
 */
export function syncCatalog(viewer: number | null): Promise<void> {
  running ??= (async () => {
    update({ syncing: true });
    try {
      await loadFromDevice();
      const replaceAll = viewer !== viewerId || cursor === null;
      const [songDelta, playlists] = await Promise.all([
        trpcClient.songs.sync.query({ since: replaceAll ? null : cursor }),
        trpcClient.playlists.all.query(),
      ]);
      const songs = replaceAll ? new Map<number, SongRecord>() : new Map(state.songs);
      songDelta.songs.forEach((s) => songs.set(s.id, s));
      songDelta.removedIds.forEach((id) => songs.delete(id));
      cursor = songDelta.cursor;
      viewerId = viewer;
      update({
        songs,
        playlists: new Map(playlists.map((p) => [p.id, p])),
        synced: true,
      });
      await Promise.all([
        storeSongs({ ...songDelta, replaceAll }, { cursor, viewerId }),
        storePlaylists(playlists),
      ]);
    } catch {
      // Offline or the server is away: the device copy stays in use, and the next sync retries.
    } finally {
      update({ syncing: false });
      running = null;
    }
  })();
  return running;
}

/** Applies a song the server just returned, without waiting for the next sync. */
export function putSong(song: SongRecord) {
  const songs = new Map(state.songs);
  songs.set(song.id, song);
  update({ songs });
  void storeSongs(
    { songs: [song], removedIds: [], replaceAll: false },
    { cursor, viewerId },
  );
}

/** Drops a song deleted on this device, without waiting for the next sync. */
export function dropSong(id: number) {
  const songs = new Map(state.songs);
  songs.delete(id);
  update({ songs });
  void storeSongs(
    { songs: [], removedIds: [id], replaceAll: false },
    { cursor, viewerId },
  );
}

/** Applies a playlist the server just returned, or removes one (`null`). */
export function putPlaylist(id: number, playlist: PlaylistRecord | null) {
  const playlists = new Map(state.playlists);
  if (playlist) {
    playlists.set(id, playlist);
  } else {
    playlists.delete(id);
  }
  update({ playlists });
  void storePlaylists([...playlists.values()]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void loadFromDevice();
  return () => listeners.delete(listener);
}

export function useCatalog(): Catalog {
  return useSyncExternalStore(subscribe, () => view);
}
