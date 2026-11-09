import { useEffect } from 'react';

/** Keeps the screen on while mounted: nobody should have to tap a phone awake mid-song. */
export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) {
      return;
    }
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (!active) {
          await lock.release();
        }
      } catch {
        // Refused (battery saver, not visible): the screen just sleeps as usual.
      }
    };
    // The browser drops the lock whenever the page is hidden; take it again on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void acquire();
      }
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}
