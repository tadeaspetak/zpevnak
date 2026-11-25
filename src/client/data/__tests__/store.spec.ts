import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { loadStored } from '../store.ts';

describe('the device’s database', () => {
  it('works from memory rather than hang while an old tab holds the old version', async () => {
    // A tab of the app from before notes (version 1), still open, and deaf to upgrades.
    const old = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('zpevnak', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('songs', { keyPath: 'id' });
        request.result.createObjectStore('playlists', { keyPath: 'id' });
        request.result.createObjectStore('meta');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await expect(loadStored()).resolves.toMatchObject({ songs: [], notes: [] });
    old.close();
    // Once it's gone, the upgrade goes through: notes have their store.
    await expect(loadStored()).resolves.toMatchObject({ notes: [] });
  });
});
