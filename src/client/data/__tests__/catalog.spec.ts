import { describe, expect, it } from 'vitest';
import { mergePlaylists, mergeSongs, playable, type Catalog } from '../catalog.ts';
import type { PlaylistRecord, SongRecord } from '../store.ts';

const song = (id: number, title = `Song ${id}`) => ({ id, title }) as SongRecord;
const playlist = (
  id: number,
  songIds: number[],
  updatedAt = '2026-11-10T10:00:00.000Z',
) => ({ id, name: `List ${id}`, songIds, updatedAt }) as PlaylistRecord;
const songs = (...list: SongRecord[]) => new Map(list.map((s) => [s.id, s]));

describe('mergeSongs', () => {
  it('applies what changed and drops what was deleted', () => {
    const merged = mergeSongs(
      songs(song(1), song(2)),
      { songs: [song(2, 'Changed'), song(3)], removedIds: [1] },
      false,
    );
    expect([...merged.values()].map((s) => [s.id, s.title])).toEqual([
      [2, 'Changed'],
      [3, 'Song 3'],
    ]);
  });

  it('starts over for a new viewer: nothing of the last one stays', () => {
    const merged = mergeSongs(
      songs(song(1), song(2)),
      { songs: [song(3)], removedIds: [] },
      true,
    );
    expect([...merged.keys()]).toEqual([3]);
  });
});

describe('mergePlaylists', () => {
  it('takes the fetched playlists, and drops ones that are gone', () => {
    const local = new Map([
      [1, playlist(1, [1])],
      [2, playlist(2, [2])],
    ]);
    const merged = mergePlaylists(local, [
      playlist(1, [1, 2], '2026-11-10T11:00:00.000Z'),
    ]);
    expect([...merged.values()].map((p) => p.songIds)).toEqual([[1, 2]]);
  });

  it("keeps this device's newer copy over an answer that was already on its way", () => {
    const edited = playlist(1, [1, 2, 3], '2026-11-10T12:00:00.000Z');
    const merged = mergePlaylists(new Map([[1, edited]]), [playlist(1, [1, 2])]);
    expect(merged.get(1)).toBe(edited);
  });
});

describe('playable', () => {
  it("leaves out of each playlist the songs this device doesn't have (a deleted one)", () => {
    const raw = {
      songs: songs(song(1), song(3)),
      playlists: new Map([[7, playlist(7, [1, 2, 3])]]),
    } as Catalog;
    expect(playable(raw).playlists.get(7)?.songIds).toEqual([1, 3]);
  });
});
