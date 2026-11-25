import { describe, expect, it } from 'vitest';
import {
  columnsFit,
  lineWraps,
  translateYOf,
  type Box,
  type TextLine,
} from '../columnsFit.ts';

const line = (
  left: number,
  right: number,
  bottom: number,
  wrapped = false,
): TextLine => ({
  top: bottom - 30,
  bottom,
  left,
  right,
  wrapped,
});
// A pill in the middle of a 1000 × 700 screen, its top 70 px above the bottom.
const pill: Box = { top: 630, bottom: 690, left: 280, right: 720 };

describe('columnsFit', () => {
  it('fits when every line ends above the bottom of the screen', () => {
    expect(columnsFit([line(20, 400, 300), line(520, 900, 700)], [], 700)).toBe(true);
  });

  it("doesn't fit when a line runs past the bottom", () => {
    expect(columnsFit([line(20, 400, 701)], [], 700)).toBe(false);
  });

  it('lets a line end beside the pill, left or right of it', () => {
    expect(columnsFit([line(20, 250, 680), line(740, 950, 680)], [pill], 700)).toBe(true);
  });

  it("doesn't fit when text would go under the pill", () => {
    expect(columnsFit([line(520, 600, 650)], [pill], 700)).toBe(false);
    expect(columnsFit([line(20, 300, 650)], [pill], 700)).toBe(false);
  });

  it('lets text above the pill run across under where it is', () => {
    expect(columnsFit([line(20, 980, 630)], [pill], 700)).toBe(true);
  });

  it("doesn't fit when a line had to wrap in its column, however short the song", () => {
    // A tablet held upright fits two columns of short lines; a phone, or bigger text, wraps.
    expect(columnsFit([line(20, 300, 200), line(20, 300, 240, true)], [], 1000)).toBe(
      false,
    );
  });
});

describe('lineWraps', () => {
  it('sees a line on more than one row, and a pixel’s difference as one row', () => {
    expect(lineWraps([100, 100, 130])).toBe(true);
    expect(lineWraps([100, 101, 100.5])).toBe(false);
    expect(lineWraps([100])).toBe(false);
    expect(lineWraps([])).toBe(false);
  });
});

describe('translateYOf', () => {
  it('reads how far a transform moves a bar down, and nothing from none', () => {
    expect(translateYOf('matrix(1, 0, 0, 1, 0, 60)')).toBe(60);
    expect(
      translateYOf('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 72, 0, 1)'),
    ).toBe(72);
    expect(translateYOf('none')).toBe(0);
  });
});
