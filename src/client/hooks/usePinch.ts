import { type RefObject, useEffect, useRef } from 'react';
import { pinchedScale } from '../data/prefs.ts';
import { extendHold, holdPlace } from '../song/keepPlace.ts';

type Touches = { length: number; [index: number]: { clientX: number; clientY: number } };

const spread = (touches: Touches) => {
  const a = touches[0];
  const b = touches[1];
  return a && b ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 0;
};

/** A pause this long ends a touchpad pinch: the next one starts from the size it finds. */
const WHEEL_GESTURE_MS = 300;

/**
 * How far one turn of the wheel spreads (> 1) or pinches: a touchpad sends many small turns, a
 * mouse one big one per notch, kept to about a size step.
 */
export function wheelRatio(e: Pick<WheelEvent, 'deltaY' | 'deltaMode'>): number {
  // Lines (Firefox with a mouse) as pixels, roughly.
  const pixels = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  return Math.exp(-Math.max(-25, Math.min(25, pixels)) / 100);
}

/**
 * Two fingers spreading or pinching on the song (`within`) change the text size, live, along
 * its steps (`pinchedScale`), the way the size buttons do. The song doesn't zoom: it has
 * `touch-action: pan-x pan-y`, so the text reflows instead of spilling sideways. Elsewhere
 * (the toolbar, a menu) the browser's own zoom still works. One finger keeps scrolling, and
 * swiping between songs (`useSwipe` ignores two fingers).
 *
 * A laptop's touchpad pinches too (D137): Chrome, Edge and Firefox send it as a wheel with
 * Ctrl held, Safari as its own gesture. On the song both change the text size rather than zoom
 * the page; so does Ctrl and a mouse wheel, a notch about a step. Keyboard zoom stays the
 * browser's.
 */
export function usePinch(
  within: RefObject<HTMLElement | null>,
  scale: number,
  setScale: (scale: number) => void,
) {
  // Read as the fingers move, without starting over each time the size changes under them.
  const current = useRef(scale);
  current.current = scale;
  useEffect(() => {
    let start: { distance: number; scale: number } | null = null;
    const onSong = (e: Event) =>
      e.target instanceof Node && Boolean(within.current?.contains(e.target));
    const onStart = (e: TouchEvent) => {
      const distance = e.touches.length === 2 && onSong(e) ? spread(e.touches) : 0;
      start = distance > 0 ? { distance, scale: current.current } : null;
      const [a, b] = [e.touches[0], e.touches[1]];
      if (start && a && b) {
        // The line between the fingers stays under them as the text grows or shrinks.
        holdPlace((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 2) {
        return;
      }
      const next = pinchedScale(start.scale, spread(e.touches) / start.distance);
      extendHold();
      if (next !== current.current) {
        setScale(next);
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        start = null;
      }
    };
    // A touchpad's pinch (or Ctrl and a wheel): one gesture while the wheel keeps turning,
    // each turn spreading or pinching a little.
    let wheel: { scale: number; ratio: number } | null = null;
    let wheelIdle: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || !onSong(e)) {
        return;
      }
      e.preventDefault();
      if (!wheel) {
        wheel = { scale: current.current, ratio: 1 };
        holdPlace(e.clientX, e.clientY);
      }
      wheel.ratio *= wheelRatio(e);
      clearTimeout(wheelIdle);
      wheelIdle = setTimeout(() => {
        wheel = null;
      }, WHEEL_GESTURE_MS);
      extendHold();
      const next = pinchedScale(wheel.scale, wheel.ratio);
      if (next !== current.current) {
        setScale(next);
      }
    };
    // Safari's own pinch gesture: on a Mac's touchpad it is the pinch; on iOS the fingers
    // already pinch (above), and `touch-action` alone doesn't always stop it zooming.
    let gesture: number | null = null;
    const onGesture = (e: Event) => {
      if (!onSong(e)) {
        return;
      }
      e.preventDefault();
      const scale = (e as Event & { scale?: number }).scale;
      if (e.type === 'gesturestart') {
        gesture = current.current;
        holdPlace((e as MouseEvent).clientX, (e as MouseEvent).clientY);
      } else if (e.type === 'gestureend') {
        gesture = null;
      } else if (gesture !== null && start === null && scale) {
        extendHold();
        const next = pinchedScale(gesture, scale);
        if (next !== current.current) {
          setScale(next);
        }
      }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('gesturestart', onGesture);
    window.addEventListener('gesturechange', onGesture);
    window.addEventListener('gestureend', onGesture);
    return () => {
      clearTimeout(wheelIdle);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('gesturechange', onGesture);
      window.removeEventListener('gestureend', onGesture);
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
      window.removeEventListener('gesturestart', onGesture);
    };
  }, [within, setScale]);
}
