import { describe, expect, it } from 'vitest';
import { pageDownBy } from '../pageTurn.ts';

/** Lines 60 px tall, one under another from `from`. */
const lines = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    top: from + i * 60,
    bottom: from + i * 60 + 56,
  }));

describe('pageDownBy (D148)', () => {
  it('brings the first line cut at the bottom to the top, chords and all', () => {
    // A screen 800 px tall: the line from 780 to 836 is cut.
    expect(pageDownBy(lines(0, 20), 800)).toBe(780 - 8);
  });

  it('moves by most of a screen when no line is cut, or the cut one is too near the top', () => {
    expect(pageDownBy(lines(0, 5), 800)).toBe(640);
    expect(pageDownBy([{ top: 100, bottom: 1200 }], 800)).toBe(640);
  });
});
