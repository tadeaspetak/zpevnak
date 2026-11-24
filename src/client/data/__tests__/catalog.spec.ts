import { describe, expect, it } from 'vitest';
import {
  mergePlaylists,
  mergeSongs,
  playable,
  privateSongsNotSent,
  type Catalog,
} from '../catalog.ts';
import { fromDevice, type PlaylistRecord, type SongRecord } from '../store.ts';

const song = (id: number, title = `Song ${id}`) => ({ id, title }) as SongRecord;
const playlist = (
  id: number,
  songIds: number[],
  updatedAt = '2026-11-10T10:00:00.000Z',
) => ({ id, name: `List ${id}`, songIds, updatedAt }) as PlaylistRecord;
const songs = (...list: SongRecord[]) => new Map(list.map((s) => [s.id, s]));

describe('mergeSongs', () => {
  it('starts over for a new viewer, keeping what they put here meanwhile (a song joined)', () => {
    const merged = mergeSongs(
      songs(song(1), song(2)),
      { songs: [song(3)], removedIds: [] },
      true,
      new Set([2]),
    );
    expect([...merged.keys()].sort()).toEqual([2, 3]);
  });

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

describe('privateSongsNotSent (D127)', () => {
  const at = (id: number, status: SongRecord['status']) => ({ id, status }) as SongRecord;

  it('finds private songs the sync no longer sends: no longer shared, or deleted', () => {
    const here = songs(
      at(1, 'private'),
      at(2, 'private'),
      // Public songs come only when they change: one not sent is just unchanged.
      at(3, 'verified'),
    );
    expect(privateSongsNotSent(here, [at(2, 'private')], new Set())).toEqual([1]);
  });

  it('keeps one put here while the sync ran: made, or joined by an invite, meanwhile', () => {
    // Joined: the song itself is old, so its date says nothing about the answer.
    expect(privateSongsNotSent(songs(at(1, 'private')), [], new Set([1]))).toEqual([]);
  });
});

describe('mergePlaylists', () => {
  it('keeps a playlist joined while the fetch ran, and one left stays gone', () => {
    // Signing up from an invite: the sync starts, the join lands first, the answer predates it.
    const local = new Map([[5, playlist(5, [])]]);
    expect([...mergePlaylists(local, [], new Set([5])).keys()]).toEqual([5]);
    // Left meanwhile: the answer still has it, the device doesn't.
    expect([
      ...mergePlaylists(new Map(), [playlist(6, [])], new Set([6])).keys(),
    ]).toEqual([]);
  });

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

describe('fromDevice', () => {
  it('gives a playlist kept by an older version the fields it lacks (D131), not a crash', () => {
    const old = { id: 1, name: 'Vršek', songIds: [1] } as unknown as PlaylistRecord;
    expect(fromDevice(old).songKeys).toEqual({});
    const current = { ...old, songKeys: { 1: { semitones: 2, from: 0 } } };
    expect(fromDevice(current).songKeys).toEqual({ 1: { semitones: 2, from: 0 } });
  });
});
