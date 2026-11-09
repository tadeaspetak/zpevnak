import { useEffect } from 'react';

/**
 * Calls back on a clear horizontal swipe anywhere on the page. A swipe that is mostly
 * vertical is a scroll, and one starting at the screen edge is the system's back gesture.
 */
export function useSwipe(handlers: { onLeft?: () => void; onRight?: () => void }) {
  const { onLeft, onRight } = handlers;
  useEffect(() => {
    let start: { x: number; y: number; t: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || e.touches.length > 1) {
        start = null;
        return;
      }
      const edge = 24;
      start =
        touch.clientX < edge || touch.clientX > window.innerWidth - edge
          ? null
          : { x: touch.clientX, y: touch.clientY, t: Date.now() };
    };
    const onEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!start || !touch) {
        return;
      }
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const quick = Date.now() - start.t < 600;
      start = null;
      if (!quick || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) {
        return;
      }
      if (dx < 0) {
        onLeft?.();
      } else {
        onRight?.();
      }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [onLeft, onRight]);
}
