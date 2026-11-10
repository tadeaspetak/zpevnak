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
export function playable(raw: Catalog): Catalog {
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

/** The songs after a sync: the delta applied, or, for a new viewer, the delta alone. */
export function mergeSongs(
  songs: Map<number, SongRecord>,
  delta: { songs: SongRecord[]; removedIds: number[] },
  replaceAll: boolean,
): Map<number, SongRecord> {
  const merged = replaceAll ? new Map<number, SongRecord>() : new Map(songs);
  delta.songs.forEach((s) => merged.set(s.id, s));
  delta.removedIds.forEach((id) => merged.delete(id));
  return merged;
}

/**
 * The playlists after a fetch of them all. One this device changed since the fetch left (its
 * own edit came back first) keeps the newer copy: an answer that was on its way doesn't undo it.
 */
export function mergePlaylists(
  local: Map<number, PlaylistRecord>,
  fetched: PlaylistRecord[],
): Map<number, PlaylistRecord> {
  return new Map(fetched.map((p) => [p.id, newer(local.get(p.id), p)]));
}

function newer(
  local: PlaylistRecord | undefined,
  incoming: PlaylistRecord,
): PlaylistRecord {
  return local && local.updatedAt > incoming.updatedAt ? local : incoming;
}

async function runSync(viewer: number | null) {
  update({ syncing: true });
  try {
    await loadFromDevice();
    const replaceAll = viewer !== viewerId || cursor === null;
    if (viewer !== viewerId) {
      // Someone else now: what the last person could see leaves the device before anything
      // is fetched, so a fetch that fails can't leave their private songs and playlists here.
      cursor = null;
      viewerId = viewer;
      update({ songs: new Map(), playlists: new Map() });
      await Promise.all([
        storeSongs({ songs: [], removedIds: [], replaceAll: true }, { cursor, viewerId }),
        storePlaylists([]),
      ]);
    }
    const [songDelta, playlists] = await Promise.all([
      trpcClient.songs.sync.query({ since: replaceAll ? null : cursor }),
      trpcClient.playlists.all.query(),
    ]);
    cursor = songDelta.cursor;
    update({
      songs: mergeSongs(state.songs, songDelta, replaceAll),
      playlists: mergePlaylists(state.playlists, playlists),
      synced: true,
    });
    await Promise.all([
      storeSongs({ ...songDelta, replaceAll }, { cursor, viewerId }),
      storePlaylists([...state.playlists.values()]),
    ]);
  } catch {
    // Offline or the server is away: the device copy stays in use, and the next sync retries.
  } finally {
    update({ syncing: false });
  }
}

let running: { viewer: number | null; done: Promise<void> } | null = null;

/**
 * Brings the catalog up to date. `viewer` is who is signed in (null: nobody); when it
 * changes, the catalog is fetched whole, because each viewer sees different songs. A sync
 * already running for the same viewer is joined; one for someone else (a sign-in or sign-out
 * while it ran) is waited for, then this one runs.
 */
export function syncCatalog(viewer: number | null): Promise<void> {
  if (running?.viewer === viewer) {
    return running.done;
  }
  const done = (running?.done ?? Promise.resolve()).then(() => runSync(viewer));
  const current = { viewer, done };
  running = current;
  void done.finally(() => {
    if (running === current) {
      running = null;
    }
  });
  return done;
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

/**
 * Applies a playlist the server just returned, or removes one (`null`). An answer older than
 * the copy here (a page's fetch overtaken by an edit) is ignored.
 */
export function putPlaylist(id: number, playlist: PlaylistRecord | null) {
  const playlists = new Map(state.playlists);
  if (playlist) {
    playlists.set(id, newer(playlists.get(id), playlist));
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
