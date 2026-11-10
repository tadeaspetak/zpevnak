import { describe, expect, it } from 'vitest';
import { columnsFit, type Box } from '../columnsFit.ts';

const line = (left: number, right: number, bottom: number): Box => ({
  top: bottom - 30,
  bottom,
  left,
  right,
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
});
