import { useEffect } from 'react';

/**
 * Global keyboard shortcuts, ignored while typing in a field. Bluetooth page turners send
 * arrow or Page Up/Down keys, so they work through this too.
 */
export function useKeys(map: Record<string, (() => void) | undefined>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      const handler = map[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map]);
}
