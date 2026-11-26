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
  dbPromise ??= new Promise<IDBPDatabase<ZpevnakDB>>((resolve, reject) => {
    openDB<ZpevnakDB>('zpevnak', 2, {
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
      // A tab still open on an older version holds the old database and won't let go (one
      // from before this handler can't be asked to). Rather than wait for it, this visit works
      // from memory, as in a private window, and tries again next time.
      blocked() {
        dbPromise = null;
        reject(new Error('IndexedDB upgrade blocked by another tab'));
      },
      // A newer version opened in another tab: this one lets go, and opens anew when it next
      // needs the database.
      blocking(_current, _blocked, event) {
        (event.target as IDBDatabase).close();
        dbPromise = null;
      },
    }).then(resolve, reject);
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

/**
 * A note as an older version kept it (D143 added `kind` and `resolvedAt`): from before reports,
 * so its kind is what its playlist said, and it was never resolved.
 */
export function noteFromDevice(
  note: Omit<NoteRecord, 'kind' | 'resolvedAt'> & Partial<NoteRecord>,
): NoteRecord {
  return {
    ...note,
    kind: note.kind ?? (note.playlistId === null ? 'own' : 'playlist'),
    resolvedAt: note.resolvedAt ?? null,
  };
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
      notes: notes.map(noteFromDevice),
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
