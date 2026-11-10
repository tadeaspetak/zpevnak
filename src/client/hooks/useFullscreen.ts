import { useCallback, useEffect, useState } from 'react';

/** The Fullscreen API where the browser has it. iPhone Safari doesn't: `supported` is false. */
export function useFullscreen() {
  const supported =
    typeof document !== 'undefined' && document.fullscreenEnabled === true;
  const [active, setActive] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const onChange = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, []);
  /** Installed to the home screen: already without browser bars. */
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  return { supported, active, toggle, standalone };
}
