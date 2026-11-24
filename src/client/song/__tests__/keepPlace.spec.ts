import { describe, expect, it } from 'vitest';
import { lineAt } from '../keepPlace.ts';

describe('lineAt', () => {
  const lines = [
    { top: 0, bottom: 30 },
    { top: 40, bottom: 70 },
    { top: 80, bottom: 110 },
  ];

  it('finds the line across a point, else the first below it', () => {
    expect(lineAt(lines, 50)).toBe(1);
    expect(lineAt(lines, 75)).toBe(2);
    expect(lineAt(lines, 200)).toBe(-1);
  });
});
