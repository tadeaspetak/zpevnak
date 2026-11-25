import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { LONG_PRESS_MS, useLinePress, type LinePress } from '../useLinePress.ts';

const at = (clientX: number, clientY = 100) => [{ clientX, clientY }];

describe('useLinePress (D135)', () => {
  const sheet = document.createElement('div');
  sheet.innerHTML = '<p data-place="4">la la la</p><button>Poznámka</button><p>nic</p>';
  const line = sheet.querySelector('p') as HTMLElement;
  const within = { current: sheet };
  let onPress: Mock<(press: LinePress) => void>;
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.append(sheet);
    onPress = vi.fn();
    renderHook(() => useLinePress(within, onPress));
  });
  afterEach(() => {
    vi.useRealTimers();
    sheet.remove();
  });

  it('answers a finger resting on a line, with the line and where', () => {
    fireEvent.touchStart(line, { touches: at(50) });
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(onPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onPress).toHaveBeenCalledWith({ place: 4, x: 50, y: 100 });
  });

  it('leaves a tap, a scroll and a pinch alone', () => {
    fireEvent.touchStart(line, { touches: at(50) });
    fireEvent.touchEnd(line, { changedTouches: at(50) });
    fireEvent.touchStart(line, { touches: at(50) });
    fireEvent.touchMove(line, { touches: at(50, 140) });
    fireEvent.touchStart(line, { touches: [...at(50), ...at(150)] });
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps the lift after a long-press from tapping (it would hide the toolbar)', () => {
    fireEvent.touchStart(line, { touches: at(50) });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(fireEvent.touchEnd(line, { changedTouches: at(50) })).toBe(false);
    fireEvent.touchStart(line, { touches: at(50) });
    expect(fireEvent.touchEnd(line, { changedTouches: at(50) })).toBe(true);
  });

  it('answers a right-click at once, and Android’s long-press only once', () => {
    expect(fireEvent.contextMenu(line, { clientX: 30, clientY: 60 })).toBe(false);
    expect(onPress).toHaveBeenCalledWith({ place: 4, x: 30, y: 60 });
    onPress.mockClear();
    fireEvent.touchStart(line, { touches: at(50) });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    fireEvent.contextMenu(line, { clientX: 50, clientY: 100 });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is only about lines: a button, or text that takes no note, keeps its own menu', () => {
    const button = sheet.querySelector('button') as HTMLElement;
    const blank = sheet.querySelectorAll('p')[1] as HTMLElement;
    expect(fireEvent.contextMenu(button)).toBe(true);
    expect(fireEvent.contextMenu(blank)).toBe(true);
    fireEvent.touchStart(button, { touches: at(50) });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onPress).not.toHaveBeenCalled();
  });
});
