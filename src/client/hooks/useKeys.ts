import { useEffect } from 'react';

const OVERLAY = '[role="menu"], [role="dialog"], [role="listbox"]';

/**
 * Whether the key belongs to something open on top of the page rather than to the page: a
 * menu, a popover or a dialog (focus inside it, or still on the button that opened it), or a
 * component that already handled it. Esc there closes that thing, never leaves the song. Also
 * while one is open at all: a button that went away as it was pressed (Zrušit, Beru zpátky)
 * drops the focus to the page, behind the dialog still open.
 */
function belongsToOverlay(e: KeyboardEvent, target: HTMLElement | null) {
  return (
    e.defaultPrevented ||
    Boolean(target?.closest(OVERLAY)) ||
    target?.getAttribute('aria-expanded') === 'true' ||
    document.querySelector(OVERLAY) !== null
  );
}

/**
 * Global keyboard shortcuts, ignored while typing in a field or using a menu or dialog.
 * Bluetooth page turners send arrow or Page Up/Down keys, so they work through this too.
 */
export function useKeys(map: Record<string, (() => void) | undefined>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        target?.closest('input, textarea, select, [contenteditable="true"]') ||
        belongsToOverlay(e, target)
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
