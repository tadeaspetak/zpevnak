import { describe, expect, it } from 'vitest';
import { followSong } from '../followSong.ts';

describe('followSong', () => {
  it('stays put when nothing moved', () => {
    expect(followSong([1, 2, 3], 2, 2)).toEqual({ position: 2, removed: false });
  });

  it('follows the song when someone inserts before it', () => {
    // Playing song 3 at position 3; someone put song 9 at the top.
    expect(followSong([9, 1, 2, 3], 3, 3)).toEqual({ position: 4, removed: false });
  });

  it('follows the song when it is moved', () => {
    expect(followSong([3, 1, 2], 3, 3)).toEqual({ position: 1, removed: false });
  });

  it('stays at its place, flagged, when the song is taken out', () => {
    expect(followSong([1, 3], 2, 2)).toEqual({ position: 2, removed: true });
  });

  it('of a song in twice, follows the appearance nearest where it was', () => {
    // Playing the second 5, at position 4 of [5, 1, 2, 5]; someone put 9 at the top.
    expect(followSong([9, 5, 1, 2, 5], 5, 4)).toEqual({ position: 5, removed: false });
  });
});
