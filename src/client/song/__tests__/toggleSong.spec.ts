import { describe, expect, it } from 'vitest';
import { toggleSong } from '../toggleSong.ts';

describe('toggleSong', () => {
  it('adds a song that is not in the playlist to the end', () => {
    expect(toggleSong([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleSong([], 3)).toEqual([3]);
  });

  it('takes out a song that is in', () => {
    expect(toggleSong([1, 2, 3], 2)).toEqual([1, 3]);
  });

  it('takes out only the last appearance of a song that is in twice', () => {
    expect(toggleSong([1, 2, 1, 3], 1)).toEqual([1, 2, 3]);
  });

  it('toggled twice, a new song is gone again', () => {
    expect(toggleSong(toggleSong([1, 2], 3), 3)).toEqual([1, 2]);
  });
});
