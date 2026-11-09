import { useLocation } from 'react-router';

/** Carried by a link into a page that can be reached from several places. */
export type BackState = { backTo: string; backLabel?: string };

/**
 * Where a page's back arrow leads: the page that linked here, when it said so in the link's
 * state, else the page's usual parent.
 */
export function useBack(fallback: { to: string; label: string }) {
  const state = useLocation().state as Partial<BackState> | null;
  return state?.backTo && state.backLabel
    ? { to: state.backTo, label: state.backLabel }
    : fallback;
}
