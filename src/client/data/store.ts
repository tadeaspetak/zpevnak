/**
 * The device's copy of the catalog: every song and playlist the viewer can see, in
 * IndexedDB, so the app opens and searches without a network.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PlaylistRecord } from '#server/playlists/load.ts';
import type { SongRecord } from '#server/songs/record.ts';

export type { PlaylistRecord, SongRecord };

type SyncState = {
  /** The server's cursor from the last song sync. */
  cursor: string | null;
  /** Whose catalog this is: a different viewer sees different songs, so it starts over. */
  viewerId: number | null;
};

interface ZpevnakDB extends DBSchema {
  songs: { key: number; value: SongRecord };
  playlists: { key: number; value: PlaylistRecord };
  meta: { key: 'sync'; value: SyncState };
}

let dbPromise: Promise<IDBPDatabase<ZpevnakDB>> | null = null;

function database() {
  dbPromise ??= openDB<ZpevnakDB>('zpevnak', 1, {
    upgrade(db) {
      db.createObjectStore('songs', { keyPath: 'id' });
      db.createObjectStore('playlists', { keyPath: 'id' });
      db.createObjectStore('meta');
    },
  });
  return dbPromise;
}

export async function loadStored() {
  try {
    const db = await database();
    const [songs, playlists, sync] = await Promise.all([
      db.getAll('songs'),
      db.getAll('playlists'),
      db.get('meta', 'sync'),
    ]);
    return { songs, playlists, sync: sync ?? { cursor: null, viewerId: null } };
  } catch {
    // No IndexedDB (some private windows): the app still works online, from memory.
    return { songs: [], playlists: [], sync: { cursor: null, viewerId: null } };
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

export async function storePlaylists(playlists: PlaylistRecord[]) {
  try {
    const db = await database();
    const tx = db.transaction('playlists', 'readwrite');
    await tx.store.clear();
    await Promise.all(playlists.map((p) => tx.store.put(p)));
    await tx.done;
  } catch {
    // As above: memory only.
  }
}
