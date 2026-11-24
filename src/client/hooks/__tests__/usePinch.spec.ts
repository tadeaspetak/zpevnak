import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { describe, expect, it, vi } from 'vitest';
import { FONT_SCALES, pinchedScale } from '../../data/prefs.ts';
import { usePinch } from '../usePinch.ts';

const fingers = (...xs: number[]) => xs.map((clientX) => ({ clientX, clientY: 300 }));

describe('pinchedScale', () => {
  it('follows the fingers along the text sizes, snapping to the nearest', () => {
    expect(pinchedScale(1, 1)).toBe(1);
    expect(pinchedScale(1, 1.2)).toBe(1.15);
    expect(pinchedScale(1, 1.5)).toBe(1.5);
    expect(pinchedScale(1.3, 0.7)).toBe(0.9);
  });

  it('stops at either end', () => {
    expect(pinchedScale(1, 10)).toBe(FONT_SCALES.at(-1));
    expect(pinchedScale(1, 0.1)).toBe(FONT_SCALES[0]);
  });
});

describe('usePinch', () => {
  // The song: pinches on it are ours; elsewhere the browser's.
  const song = document.createElement('div');
  const within = { current: song };
  beforeEach(() => {
    document.body.append(song);
  });
  afterEach(() => {
    song.remove();
  });

  it('changes the text size as two fingers spread, live', () => {
    const setScale = vi.fn();
    renderHook(() => usePinch(within, 1, setScale));
    fireEvent.touchStart(song, { touches: fingers(100, 200) });
    fireEvent.touchMove(song, { touches: fingers(85, 215) });
    fireEvent.touchMove(song, { touches: fingers(50, 250) });
    expect(setScale.mock.calls.map(([scale]) => scale)).toEqual([1.3, 2]);
  });

  it('leaves one finger alone: it scrolls, or swipes to the next song', () => {
    const setScale = vi.fn();
    renderHook(() => usePinch(within, 1, setScale));
    fireEvent.touchStart(song, { touches: fingers(100) });
    fireEvent.touchMove(song, { touches: fingers(300) });
    expect(setScale).not.toHaveBeenCalled();
  });

  it('starts each pinch from the size it found', () => {
    const setScale = vi.fn();
    const { rerender } = renderHook(({ scale }) => usePinch(within, scale, setScale), {
      initialProps: { scale: 1 },
    });
    fireEvent.touchStart(song, { touches: fingers(100, 200) });
    fireEvent.touchMove(song, { touches: fingers(75, 225) });
    fireEvent.touchEnd(song, { touches: fingers(225) });
    rerender({ scale: 1.5 });
    fireEvent.touchStart(song, { touches: fingers(100, 200) });
    fireEvent.touchMove(song, { touches: fingers(125, 175) });
    expect(setScale.mock.calls.map(([scale]) => scale)).toEqual([1.5, 0.8]);
  });

  it('leaves a pinch elsewhere (the toolbar) to the browser’s own zoom', () => {
    const setScale = vi.fn();
    renderHook(() => usePinch(within, 1, setScale));
    fireEvent.touchStart(document.body, { touches: fingers(100, 200) });
    fireEvent.touchMove(document.body, { touches: fingers(50, 250) });
    expect(setScale).not.toHaveBeenCalled();
  });
});
