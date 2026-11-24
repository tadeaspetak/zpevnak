import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isKeepingPlace } from '../../song/keepPlace.ts';

vi.mock('../../song/keepPlace.ts', () => ({ isKeepingPlace: vi.fn(() => false) }));
import { isPlainTap, useHideOnScroll } from '../useHideOnScroll.ts';

function scrollTo(y: number) {
  act(() => {
    window.scrollY = y;
    window.dispatchEvent(new Event('scroll'));
  });
}

describe('useHideOnScroll', () => {
  afterEach(() => {
    window.scrollY = 0;
    document.body.innerHTML = '';
  });

  it('hides scrolling down into the song and shows scrolling back up', () => {
    const { result } = renderHook(() => useHideOnScroll());
    scrollTo(300);
    expect(result.current.hidden).toBe(true);
    scrollTo(200);
    expect(result.current.hidden).toBe(false);
  });

  it('stays as it was when the page scrolled to keep the reader’s place (a text size step)', () => {
    // A settings panel open on the toolbar would go with it.
    const { result } = renderHook(() => useHideOnScroll());
    // Mid-song, the toolbar brought back by scrolling up a little.
    scrollTo(300);
    scrollTo(200);
    vi.mocked(isKeepingPlace).mockReturnValueOnce(true);
    scrollTo(400);
    expect(result.current.hidden).toBe(false);
  });

  it('hides and shows on a tap, and scrolling takes over again after it', () => {
    const { result } = renderHook(() => useHideOnScroll());
    act(() => result.current.toggle());
    expect(result.current.hidden).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.hidden).toBe(false);
    act(() => result.current.toggle());
    scrollTo(300);
    scrollTo(100);
    expect(result.current.hidden).toBe(false);
  });

  it('counts a tap on the song, not on a link or button in it', () => {
    document.body.innerHTML = '<p>la la <a href="/x">link</a></p>';
    expect(isPlainTap(document.querySelector('p'))).toBe(true);
    expect(isPlainTap(document.querySelector('a'))).toBe(false);
  });
});
