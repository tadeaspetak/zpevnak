import { describe, expect, it } from 'vitest';
import { applyOp, nearestIndex } from '../playlistOps.ts';

describe('applyOp', () => {
  it('adds to the end', () => {
    expect(applyOp([1, 2], { type: 'add', songId: 3 })).toEqual([1, 2, 3]);
  });

  it('removes the song at the index', () => {
    expect(applyOp([1, 2, 3], { type: 'remove', songId: 2, index: 1 })).toEqual([1, 3]);
  });

  it('moves a song down and up', () => {
    expect(applyOp([1, 2, 3, 4], { type: 'move', songId: 1, from: 0, to: 2 })).toEqual([
      2, 3, 1, 4,
    ]);
    expect(applyOp([1, 2, 3, 4], { type: 'move', songId: 4, from: 3, to: 0 })).toEqual([
      4, 1, 2, 3,
    ]);
  });

  it('clamps a move past the end', () => {
    expect(applyOp([1, 2, 3], { type: 'move', songId: 1, from: 0, to: 99 })).toEqual([
      2, 3, 1,
    ]);
  });

  describe('when someone else edited first', () => {
    it('removes the named song where it moved to, not whatever took its index', () => {
      // I saw [1, 2, 3] and remove 3 at index 2; meanwhile someone put 9 at the front.
      expect(applyOp([9, 1, 2, 3], { type: 'remove', songId: 3, index: 2 })).toEqual([
        9, 1, 2,
      ]);
    });

    it('does nothing when the song is already gone', () => {
      expect(applyOp([1, 3], { type: 'remove', songId: 2, index: 1 })).toEqual([1, 3]);
      expect(applyOp([1, 3], { type: 'move', songId: 2, from: 1, to: 0 })).toEqual([
        1, 3,
      ]);
    });

    it('two people adding both keep their song', () => {
      const mine = applyOp([1], { type: 'add', songId: 2 });
      expect(applyOp(mine, { type: 'add', songId: 3 })).toEqual([1, 2, 3]);
    });
  });

  it('of a song in twice, acts on the appearance nearest the one the editor saw', () => {
    expect(applyOp([5, 1, 5, 2], { type: 'remove', songId: 5, index: 2 })).toEqual([
      5, 1, 2,
    ]);
    expect(applyOp([5, 1, 5, 2], { type: 'remove', songId: 5, index: 0 })).toEqual([
      1, 5, 2,
    ]);
  });
});

describe('nearestIndex', () => {
  it('prefers the earlier appearance on a tie', () => {
    expect(nearestIndex([5, 1, 5], 5, 1)).toBe(0);
  });

  it('is -1 when the song is not there', () => {
    expect(nearestIndex([1, 2], 3, 0)).toBe(-1);
  });
});
