import { useEffect, useRef } from 'react';

/** How long a finger rests on a line before it counts as a long-press. */
export const LONG_PRESS_MS = 500;
/** How far a finger may wander and still be pressing, not scrolling (px). */
const SLOP = 10;

export type LinePress = { place: number; x: number; y: number };

/** The place of the line `target` is on (`data-place`), or null. Notes and buttons aren't lines. */
function placeAt(target: EventTarget | null): number | null {
  if (!(target instanceof Element) || target.closest('a, button, input')) {
    return null;
  }
  const line = target.closest<HTMLElement>('[data-place]');
  return line ? Number(line.dataset.place) : null;
}

/**
 * A long-press on a line of the song (touch), or a right-click on one (mouse), calls back with
 * the line's place and where it happened (D135). A tap stays the toolbar's (D93): a finger
 * that moves (a scroll, a swipe to the next song), lifts early or brings a second finger (a
 * pinch) isn't pressing. Android's long-press also fires `contextmenu`; the timer, needed for
 * iOS anyway, answers it first, once. The finger lifting after a long-press doesn't tap.
 */
export function useLinePress(
  /** Null until it is on the page (a song still loading). */
  el: HTMLElement | null,
  onPress: (press: LinePress) => void,
) {
  const latest = useRef(onPress);
  useEffect(() => {
    latest.current = onPress;
  });

  useEffect(() => {
    if (!el) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let start: { x: number; y: number } | null = null;
    let pressed = false;
    const cancel = () => {
      clearTimeout(timer);
      start = null;
    };

    const onTouchStart = (e: TouchEvent) => {
      cancel();
      pressed = false;
      const touch = e.touches[0];
      const place = placeAt(e.target);
      if (!touch || e.touches.length > 1 || place === null) {
        return;
      }
      start = { x: touch.clientX, y: touch.clientY };
      const at = { place, x: touch.clientX, y: touch.clientY };
      timer = setTimeout(() => {
        pressed = true;
        start = null;
        navigator.vibrate?.(10);
        latest.current(at);
      }, LONG_PRESS_MS);
    };
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (
        start &&
        touch &&
        Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > SLOP
      ) {
        cancel();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      cancel();
      if (pressed && e.cancelable) {
        // No click after the press: it would hide the toolbar, or close the menu just opened.
        e.preventDefault();
      }
    };
    const onContextMenu = (e: MouseEvent) => {
      const place = placeAt(e.target);
      if (place === null) {
        return;
      }
      e.preventDefault();
      if (pressed || start) {
        // A finger's long-press, which the timer answers.
        return;
      }
      latest.current({ place, x: e.clientX, y: e.clientY });
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', cancel);
    el.addEventListener('contextmenu', onContextMenu);
    return () => {
      cancel();
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', cancel);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, [el]);
}
