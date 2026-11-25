/**
 * The device's copy of the catalog: every song and playlist the viewer can see, in
 * IndexedDB, so the app opens and searches without a network.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { NoteRecord } from '#server/notes/record.ts';
import type { PlaylistRecord } from '#server/playlists/load.ts';
import type { SharedRecord } from '#server/sharing/access.ts';
import type { SongRecord } from '#server/songs/record.ts';

export type { NoteRecord, PlaylistRecord, SharedRecord, SongRecord };

type SyncState = {
  /** The server's cursor from the last song sync. */
  cursor: string | null;
  /** Whose catalog this is: a different viewer sees different songs, so it starts over. */
  viewerId: number | null;
};

interface ZpevnakDB extends DBSchema {
  songs: { key: number; value: SongRecord };
  playlists: { key: number; value: PlaylistRecord };
  /** Since version 2: notes on songs (D135). */
  notes: { key: number; value: NoteRecord };
  meta: { key: 'sync'; value: SyncState };
}

let dbPromise: Promise<IDBPDatabase<ZpevnakDB>> | null = null;

function database() {
  dbPromise ??= openDB<ZpevnakDB>('zpevnak', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('songs', { keyPath: 'id' });
        db.createObjectStore('playlists', { keyPath: 'id' });
        db.createObjectStore('meta');
      }
      if (oldVersion < 2) {
        db.createObjectStore('notes', { keyPath: 'id' });
      }
    },
  });
  return dbPromise;
}

/**
 * A playlist as an older version of the app kept it: fields added since are missing, and
 * get their empty value here rather than crashing the page that reads them (offline, at a gig,
 * before the next sync). `songKeys`: D131.
 */
export function fromDevice(playlist: PlaylistRecord): PlaylistRecord {
  return { ...playlist, songKeys: playlist.songKeys ?? {} };
}

export async function loadStored() {
  try {
    const db = await database();
    const [songs, playlists, notes, sync] = await Promise.all([
      db.getAll('songs'),
      db.getAll('playlists'),
      db.getAll('notes'),
      db.get('meta', 'sync'),
    ]);
    return {
      songs,
      playlists: playlists.map(fromDevice),
      notes,
      sync: sync ?? { cursor: null, viewerId: null },
    };
  } catch {
    // No IndexedDB (some private windows): the app still works online, from memory.
    return {
      songs: [],
      playlists: [],
      notes: [],
      sync: { cursor: null, viewerId: null },
    };
  }
}

export async function storeSongs(
  changes: { songs: SongRecord[]; removedIds: number[]; replaceAll: boolean },
  sync: SyncState,
) {
  try {
    const db = await database();
    const tx = db.transaction(['songs', 'meta'], 'readwrite');
    const songs = tx.objectStore('songs');
    if (changes.replaceAll) {
      await songs.clear();
    }
    await Promise.all([
      ...changes.songs.map((s) => songs.put(s)),
      ...changes.removedIds.map((id) => songs.delete(id)),
      tx.objectStore('meta').put(sync, 'sync'),
    ]);
    await tx.done;
  } catch {
    // Kept in memory for this visit; the next visit syncs from scratch.
  }
}

/** Replaces the device's playlists, or its notes: each is kept whole, as it is fetched. */
export async function storeAll(
  store: 'playlists' | 'notes',
  records: PlaylistRecord[] | NoteRecord[],
) {
  try {
    const db = await database();
    const tx = db.transaction(store, 'readwrite');
    await tx.store.clear();
    await Promise.all(records.map((r) => tx.store.put(r)));
    await tx.done;
  } catch {
    // As above: memory only.
  }
}
