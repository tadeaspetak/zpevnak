/**
 * The catalog in memory: songs, playlists and notes on songs, loaded from the device first and then kept
 * in step with the server. Components read it through `useCatalog`.
 */
import { useSyncExternalStore } from 'react';
import { trpcClient } from '../trpc.ts';
import {
  loadStored,
  storeAll,
  storeSongs,
  type NoteRecord,
  type PlaylistRecord,
  type SharedRecord,
  type SongRecord,
} from './store.ts';

/** A note as the app shows it: `waiting`, a change made offline the server hasn't had yet. */
export type LocalNote = NoteRecord & { waiting?: true };

export type Catalog = {
  songs: Map<number, SongRecord>;
  playlists: Map<number, PlaylistRecord>;
  /**
   * Every note the viewer may see (D135), with the changes made offline that wait for the
   * connection on top (`waitNote`).
   */
  notes: Map<number, LocalNote>;
  /** The device copy has been read; the lists are as complete as this device knows. */
  loaded: boolean;
  /** At least one sync with the server has finished since the app opened. */
  synced: boolean;
  syncing: boolean;
};

let state: Catalog = {
  songs: new Map(),
  playlists: new Map(),
  notes: new Map(),
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

/**
 * Notes written, changed (a note) or deleted (null) offline, waiting for the connection (D135):
 * shown at once, on top of what the server has said, and kept in memory only. On the device
 * they would outlive their request, lost with a reload, and wait for ever.
 */
const waiting = new Map<number, NoteRecord | null>();

/** The notes with what waits on top. */
export function withWaiting(
  notes: Map<number, NoteRecord>,
  pending: ReadonlyMap<number, NoteRecord | null>,
): Map<number, LocalNote> {
  if (pending.size === 0) {
    return notes;
  }
  const shown = new Map<number, LocalNote>(notes);
  for (const [id, note] of pending) {
    if (note) {
      shown.set(id, { ...note, waiting: true });
    } else {
      shown.delete(id);
    }
  }
  return shown;
}

const see = (raw: Catalog): Catalog => ({
  ...playable(raw),
  notes: withWaiting(raw.notes, waiting),
});

let view: Catalog = see(state);

function update(patch: Partial<Catalog>) {
  state = { ...state, ...patch };
  view = see(state);
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
      notes: new Map(stored.notes.map((n) => [n.id, n])),
      loaded: true,
    });
  });
  return loading;
}

/**
 * Private songs this device has that the sync didn't send: no longer shared with the viewer, or
 * deleted (D127). The sync sends every private song the viewer may read, so one missing is gone,
 * unless it was put here while the sync ran (`putMeanwhile`: one just made, or just joined by an
 * invite, which the answer may predate whatever the song's own date).
 */
export function privateSongsNotSent(
  songs: Map<number, SongRecord>,
  sentSongs: SongRecord[],
  putMeanwhile: ReadonlySet<number>,
): number[] {
  const sent = new Set(sentSongs.map((s) => s.id));
  return [...songs.values()]
    .filter((s) => s.status === 'private' && !sent.has(s.id) && !putMeanwhile.has(s.id))
    .map((s) => s.id);
}

/** Songs put into the catalog since the running sync started (`privateSongsNotSent`). */
const putDuringSync = new Set<number>();
/** Playlists put into the catalog, or taken out, since the running sync started. */
const playlistsPutDuringSync = new Set<number>();
/** Notes likewise. */
const notesPutDuringSync = new Set<number>();

/**
 * The songs after a sync: the delta applied, or, for a new viewer, the delta alone, with what
 * was put here while it ran (`putMeanwhile`: a song just joined).
 */
export function mergeSongs(
  songs: Map<number, SongRecord>,
  delta: { songs: SongRecord[]; removedIds: number[] },
  replaceAll: boolean,
  putMeanwhile: ReadonlySet<number> = new Set(),
): Map<number, SongRecord> {
  const merged = replaceAll ? only(songs, putMeanwhile) : new Map(songs);
  delta.songs.forEach((s) => merged.set(s.id, s));
  delta.removedIds.forEach((id) => merged.delete(id));
  return merged;
}

type Fetched = { id: number; updatedAt: string };

/**
 * The playlists, or the notes, after a fetch of them all. One this device changed since the
 * fetch left (its own edit came back first) keeps the newer copy: an answer that was on its way
 * doesn't undo it. One put here or taken away while the fetch ran (`putMeanwhile`: a playlist
 * joined by an invite or left, a note written or deleted) stays as it is here: the answer may
 * predate it.
 */
export function mergeFetched<T extends Fetched>(
  local: Map<number, T>,
  fetched: T[],
  putMeanwhile: ReadonlySet<number> = new Set(),
): Map<number, T> {
  const merged = new Map(fetched.map((p) => [p.id, newer(local.get(p.id), p)]));
  for (const id of putMeanwhile) {
    const mine = local.get(id);
    if (mine) {
      merged.set(id, newer(mine, merged.get(id) ?? mine));
    } else {
      merged.delete(id);
    }
  }
  return merged;
}

function newer<T extends Fetched>(local: T | undefined, incoming: T): T {
  return local && local.updatedAt > incoming.updatedAt ? local : incoming;
}

/** The entries of `map` whose ids are in `ids`. */
function only<T>(map: Map<number, T>, ids: ReadonlySet<number>): Map<number, T> {
  return new Map([...map].filter(([id]) => ids.has(id)));
}

async function runSync(viewer: number | null) {
  // From here on, what this device puts (a join, an edit) is newer than the answer coming:
  // counted before anything waits, so nothing slips in between.
  putDuringSync.clear();
  playlistsPutDuringSync.clear();
  notesPutDuringSync.clear();
  update({ syncing: true });
  try {
    await loadFromDevice();
    const replaceAll = viewer !== viewerId || cursor === null;
    if (viewer !== viewerId) {
      // Someone else now: what the last person could see leaves the device before anything
      // is fetched, so a fetch that fails can't leave their private songs, playlists and notes
      // here. Only what the new person put here meanwhile stays (a playlist they just joined).
      cursor = null;
      viewerId = viewer;
      waiting.clear();
      update({
        songs: only(state.songs, putDuringSync),
        playlists: only(state.playlists, playlistsPutDuringSync),
        notes: only(state.notes, notesPutDuringSync),
      });
      await Promise.all([
        storeSongs(
          { songs: [...state.songs.values()], removedIds: [], replaceAll: true },
          { cursor, viewerId },
        ),
        storeAll('playlists', [...state.playlists.values()]),
        storeAll('notes', [...state.notes.values()]),
      ]);
    }
    const [songDelta, playlists, notes] = await Promise.all([
      trpcClient.songs.sync.query({ since: replaceAll ? null : cursor }),
      trpcClient.playlists.all.query(),
      trpcClient.notes.visible.query(),
    ]);
    cursor = songDelta.cursor;
    const changes = {
      songs: songDelta.songs,
      removedIds: [
        ...songDelta.removedIds,
        ...privateSongsNotSent(state.songs, songDelta.songs, putDuringSync),
      ],
    };
    update({
      songs: mergeSongs(state.songs, changes, replaceAll, putDuringSync),
      playlists: mergeFetched(state.playlists, playlists, playlistsPutDuringSync),
      notes: mergeFetched(state.notes, notes, notesPutDuringSync),
      synced: true,
    });
    await Promise.all([
      storeSongs({ ...changes, replaceAll }, { cursor, viewerId }),
      storeAll('playlists', [...state.playlists.values()]),
      storeAll('notes', [...state.notes.values()]),
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
  putDuringSync.add(song.id);
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
  playlistsPutDuringSync.add(id);
  const playlists = new Map(state.playlists);
  if (playlist) {
    playlists.set(id, newer(playlists.get(id), playlist));
  } else {
    playlists.delete(id);
  }
  update({ playlists });
  void storeAll('playlists', [...playlists.values()]);
}

/**
 * Applies a note the server just returned, or removes one (`null`), without waiting for the
 * next sync (D135).
 */
export function putNote(id: number, note: NoteRecord | null) {
  notesPutDuringSync.add(id);
  const notes = new Map(state.notes);
  if (note) {
    notes.set(id, newer(notes.get(id), note));
  } else {
    notes.delete(id);
  }
  update({ notes });
  void storeAll('notes', [...notes.values()]);
}

/**
 * Shows a change to a note made offline at once, before the server has it: the note as written
 * or changed, or null for one deleted. `settleNote` takes it back when its request ends.
 */
export function waitNote(id: number, note: NoteRecord | null) {
  waiting.set(id, note);
  update({});
}

/** The request for a waiting change has ended, done or refused: the server's word stands. */
export function settleNote(id: number) {
  if (waiting.delete(id)) {
    update({});
  }
}

/** Applies a playlist or a song the sharing procedures returned, whichever it is. */
export function putShared(shared: SharedRecord) {
  switch (shared.kind) {
    case 'playlist':
      putPlaylist(shared.playlist.id, shared.playlist);
      return;
    case 'song':
      putSong(shared.song);
      return;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void loadFromDevice();
  return () => listeners.delete(listener);
}

export function useCatalog(): Catalog {
  return useSyncExternalStore(subscribe, () => view);
}
