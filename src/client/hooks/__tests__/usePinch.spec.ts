import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { describe, expect, it, vi } from 'vitest';
import { FONT_SCALES, pinchedScale } from '../../data/prefs.ts';
import { usePinch, wheelRatio } from '../usePinch.ts';

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
    // From 1.5, to 60% of the spread: 0.9.
    fireEvent.touchMove(song, { touches: fingers(120, 180) });
    expect(setScale.mock.calls.map(([scale]) => scale)).toEqual([1.5, 0.9]);
  });

  it('leaves a pinch elsewhere (the toolbar) to the browser’s own zoom', () => {
    const setScale = vi.fn();
    renderHook(() => usePinch(within, 1, setScale));
    fireEvent.touchStart(document.body, { touches: fingers(100, 200) });
    fireEvent.touchMove(document.body, { touches: fingers(50, 250) });
    expect(setScale).not.toHaveBeenCalled();
  });
});

describe('usePinch: a touchpad’s pinch (D137)', () => {
  const song = document.createElement('div');
  const within = { current: song };
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.append(song);
  });
  afterEach(() => {
    vi.useRealTimers();
    song.remove();
  });

  const pinch = (target: Element, deltaY: number, ctrlKey = true) =>
    fireEvent.wheel(target, { deltaY, ctrlKey, clientX: 100, clientY: 300 });

  it('changes the text size as the touchpad spreads, and the page doesn’t zoom', () => {
    const setScale = vi.fn();
    renderHook(() => usePinch(within, 1, setScale));
    // Many small turns, one gesture: spreading by e^0.4 ≈ 1.5.
    let zoomed = true;
    for (let i = 0; i < 8; i++) {
      zoomed = pinch(song, -5) && zoomed;
    }
    expect(zoomed).toBe(false);
    expect(setScale.mock.calls.at(-1)?.[0]).toBe(1.5);
  });

  it('starts each pinch from the size it found, once the last one rested', () => {
    const setScale = vi.fn();
    const { rerender } = renderHook(({ scale }) => usePinch(within, scale, setScale), {
      initialProps: { scale: 1 },
    });
    pinch(song, 25);
    expect(setScale).toHaveBeenLastCalledWith(0.8);
    rerender({ scale: 0.8 });
    vi.advanceTimersByTime(300);
    pinch(song, 25);
    expect(setScale).toHaveBeenLastCalledWith(0.6);
  });

  it('moves about a step for a notch of a mouse wheel, not across the whole range', () => {
    expect(pinchedScale(1, wheelRatio({ deltaY: -100, deltaMode: 0 }))).toBe(1.3);
    expect(pinchedScale(1, wheelRatio({ deltaY: 3, deltaMode: 1 }))).toBe(0.8);
  });

  it('leaves scrolling, and zoom anywhere but the song, alone', () => {
    const setScale = vi.fn();
    renderHook(() => usePinch(within, 1, setScale));
    expect(pinch(song, -50, false)).toBe(true);
    expect(pinch(document.body, -50)).toBe(true);
    expect(setScale).not.toHaveBeenCalled();
  });

  it('takes Safari’s gesture on a Mac as the pinch it is', () => {
    const setScale = vi.fn();
    renderHook(() => usePinch(within, 1, setScale));
    const gesture = (type: string, scale: number) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(e, { scale, clientX: 100, clientY: 300 });
      return song.dispatchEvent(e);
    };
    expect(gesture('gesturestart', 1)).toBe(false);
    gesture('gesturechange', 1.3);
    expect(setScale).toHaveBeenLastCalledWith(1.3);
    gesture('gestureend', 1.3);
  });
});
