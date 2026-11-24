import { useEffect, useRef } from 'react';
import { pinchedScale } from '../data/prefs.ts';

type Touches = { length: number; [index: number]: { clientX: number; clientY: number } };

const spread = (touches: Touches) => {
  const a = touches[0];
  const b = touches[1];
  return a && b ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 0;
};

/**
 * Two fingers spreading or pinching anywhere on the page change the text size, live, along its
 * steps (`pinchedScale`), the way the size buttons do. The page itself doesn't zoom: the song
 * page sets `touch-action: pan-x pan-y`, so the text reflows instead of spilling sideways. One
 * finger keeps scrolling, and swiping between songs (`useSwipe` ignores two fingers).
 */
export function usePinch(scale: number, setScale: (scale: number) => void) {
  // Read as the fingers move, without starting over each time the size changes under them.
  const current = useRef(scale);
  current.current = scale;
  useEffect(() => {
    let start: { distance: number; scale: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const distance = e.touches.length === 2 ? spread(e.touches) : 0;
      start = distance > 0 ? { distance, scale: current.current } : null;
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 2) {
        return;
      }
      const next = pinchedScale(start.scale, spread(e.touches) / start.distance);
      if (next !== current.current) {
        setScale(next);
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        start = null;
      }
    };
    // Safari's own pinch gesture, which `touch-action` alone doesn't always stop on iOS.
    const noZoom = (e: Event) => e.preventDefault();
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    window.addEventListener('gesturestart', noZoom);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
      window.removeEventListener('gesturestart', noZoom);
    };
  }, [setScale]);
}
