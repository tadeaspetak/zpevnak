import { useState } from 'react';
import { readLocal, writeLocal } from '../data/local.ts';

type State = { edited: string | null; restored: boolean };

/**
 * ChordPro being written, kept on the device as it is typed, so the back arrow, search, a reload
 * or a dead battery don't throw it away. Opening the page again carries on where it was left.
 * `original` is what the page starts from (the template, or the song as saved); the draft is
 * forgotten once it is saved, discarded, or typed back to the original. A page for another song
 * is another component (keyed by the song), so `key` stays the same for the hook's life.
 */
export function useDraft(key: string, original: string | undefined) {
  const [state, setState] = useState<State>(() => {
    const saved = readLocal(`draft:${key}`);
    return { edited: saved, restored: saved !== null };
  });
  const edited = state.edited !== null && state.edited !== original ? state.edited : null;

  const set = (value: string | null, restored: boolean) => {
    const keep = value !== null && value !== original;
    writeLocal(`draft:${key}`, keep ? value : null);
    setState({ edited: keep ? value : null, restored: keep && restored });
  };

  return {
    source: edited ?? original,
    dirty: edited !== null,
    /** Opened on a draft left from before: say so, and offer to start over. */
    restored: state.restored && edited !== null,
    setSource: (value: string) => set(value, state.restored),
    /** Saved, or thrown away: either way there is nothing left to keep. */
    clear: () => set(null, false),
  };
}
