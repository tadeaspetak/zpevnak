import { describe, expect, it } from 'vitest';
import { nextInQueue } from '../nextInQueue.ts';

describe('nextInQueue', () => {
  it('goes on to the song that followed, once the reviewed one has left the queue', () => {
    expect(nextInQueue([1, 2, 3, 4], [1, 3, 4], 2)).toBe(3);
  });

  it('goes on to the song that followed when skipping', () => {
    expect(nextInQueue([1, 2, 3], [1, 2, 3], 2)).toBe(3);
  });

  it('wraps round to the start after the last song', () => {
    expect(nextInQueue([1, 2, 3], [1, 2], 3)).toBe(1);
  });

  it('passes over songs another editor has taken meanwhile', () => {
    expect(nextInQueue([1, 2, 3, 4], [1, 4], 2)).toBe(4);
  });

  it('takes songs that arrived since, after the ones already seen', () => {
    expect(nextInQueue([1, 2], [1, 5], 2)).toBe(1);
    expect(nextInQueue([1, 2], [5], 2)).toBe(5);
  });

  it('has nothing when the reviewed song was the last one waiting', () => {
    expect(nextInQueue([2], [], 2)).toBeNull();
    expect(nextInQueue([2], [2], 2)).toBeNull();
  });
});
