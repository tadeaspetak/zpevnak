import { useEffect, useState } from 'react';

/** True while the reader scrolls down into the song; false again on scrolling up or at the top. */
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
  return [hidden, setHidden] as const;
}
