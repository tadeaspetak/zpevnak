import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FONT_SCALES, semitonesFor, usePrefs } from '../prefs.ts';

describe('usePrefs', () => {
  it('keeps a transposition within an octave, and forgets it back in the key', () => {
    const { result } = renderHook(() => usePrefs());
    act(() => result.current.setTranspose(5, 14, 9));
    expect(result.current.transpose[5]).toEqual({ semitones: 2, from: 9 });
    act(() => result.current.setTranspose(5, -13, null));
    expect(result.current.transpose[5]).toBe(-1);
    act(() => result.current.setTranspose(5, -12, 9));
    expect(5 in result.current.transpose).toBe(false);
    expect(localStorage.getItem('zpevnak.transpose')).toBe('{}');
  });

  it('keeps a song sounding where the player put it when its text changes key (D119)', () => {
    // +3 from A (9): C. The text saved in C (0) needs nothing more; saved in G (7), +5.
    const stored = { semitones: 3, from: 9 };
    expect(semitonesFor(stored, 9)).toBe(3);
    expect(semitonesFor(stored, 0)).toBe(0);
    expect(semitonesFor(stored, 7)).toBe(5);
    expect(semitonesFor({ semitones: 5, from: 0 }, 7)).toBe(-2);
    expect(semitonesFor(stored, null)).toBe(3);
  });

  it('reads a transposition saved before the starting pitch was kept, and none as 0', () => {
    expect(semitonesFor(4, 0)).toBe(4);
    expect(semitonesFor(undefined, 0)).toBe(0);
  });

  it('steps the text size along its scale, and stops at either end', () => {
    const { result } = renderHook(() => usePrefs());
    for (let i = 0; i < FONT_SCALES.length + 2; i++) {
      act(() => result.current.stepFont(1));
    }
    expect(result.current.fontScale).toBe(FONT_SCALES.at(-1));
    for (let i = 0; i < FONT_SCALES.length + 2; i++) {
      act(() => result.current.stepFont(-1));
    }
    expect(result.current.fontScale).toBe(FONT_SCALES[0]);
  });
});
