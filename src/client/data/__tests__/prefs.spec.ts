import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FONT_SCALES, usePrefs } from '../prefs.ts';

describe('usePrefs', () => {
  it('keeps a transposition within an octave, and forgets it back in the key', () => {
    const { result } = renderHook(() => usePrefs());
    act(() => result.current.setTranspose(5, 14));
    expect(result.current.transpose[5]).toBe(2);
    act(() => result.current.setTranspose(5, -13));
    expect(result.current.transpose[5]).toBe(-1);
    act(() => result.current.setTranspose(5, -12));
    expect(5 in result.current.transpose).toBe(false);
    expect(localStorage.getItem('zpevnak.transpose')).toBe('{}');
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
