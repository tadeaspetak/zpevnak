/** Whether the search overlay is open. One per app, opened from any page's search icon. */
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  open = next;
  listeners.forEach((l) => l());
}

export const openSearch = () => set(true);
export const closeSearch = () => set(false);

export function useSearchOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => open,
  );
}
