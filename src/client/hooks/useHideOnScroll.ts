import { useCallback, useEffect, useState } from 'react';

/**
 * Whether the song's toolbar is out of the way: hidden while the reader scrolls down into the
 * song, shown again on scrolling up or at the top. `toggle` is the reader's own say (a tap on
 * the song, D93); the next scroll takes over again.
 */
export function useHideOnScroll(threshold = 8) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 40) {
        setHidden(false);
      } else if (y - last > threshold) {
        setHidden(true);
      } else if (last - y > threshold) {
        setHidden(false);
      }
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  const toggle = useCallback(() => setHidden((h) => !h), []);
  return { hidden, toggle };
}

/**
 * A tap on the song itself, not a click on something in it (a link, a button) and not the end
 * of selecting text to copy.
 */
export function isPlainTap(target: EventTarget | null) {
  const selecting = (window.getSelection()?.toString() ?? '') !== '';
  return !selecting && !(target instanceof Element && target.closest('a, button, input'));
}
