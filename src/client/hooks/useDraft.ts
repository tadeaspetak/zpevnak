import { useState } from 'react';
import { readLocal, writeLocal } from '../data/local.ts';

type State = { key: string; edited: string | null; restored: boolean };

function load(key: string): State {
  const saved = readLocal(`draft:${key}`);
  return { key, edited: saved, restored: saved !== null };
}

/**
 * ChordPro being written, kept on the device as it is typed, so the back arrow, search, a reload
 * or a dead battery don't throw it away. Opening the page again carries on where it was left.
 * `original` is what the page starts from (the template, or the song as saved); the draft is
 * forgotten once it is saved, discarded, or typed back to the original.
 */
export function useDraft(key: string, original: string | undefined) {
  const [state, setState] = useState(() => load(key));
  // The review page moves from song to song without unmounting.
  let current = state;
  if (state.key !== key) {
    current = load(key);
    setState(current);
  }
  const edited =
    current.edited !== null && current.edited !== original ? current.edited : null;

  const set = (value: string | null, restored: boolean) => {
    const keep = value !== null && value !== original;
    writeLocal(`draft:${key}`, keep ? value : null);
    setState({ key, edited: keep ? value : null, restored: keep && restored });
  };

  return {
    source: edited ?? original,
    dirty: edited !== null,
    /** Opened on a draft left from before: say so, and offer to start over. */
    restored: current.restored && edited !== null,
    setSource: (value: string) => set(value, current.restored),
    /** Saved, or thrown away: either way there is nothing left to keep. */
    clear: () => set(null, false),
  };
}
