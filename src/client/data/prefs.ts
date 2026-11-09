/** How the player likes songs shown, per device. */
import { useCallback, useSyncExternalStore } from 'react';
import { readLocalJson, writeLocalJson } from './local.ts';

type Prefs = {
  fontScale: number;
  /** Chords above the lyrics; off to just sing along. */
  showChords: boolean;
  showDiagrams: boolean;
  /** Two columns for songs that ask for them. Off means a long song just scrolls down. */
  showColumns: boolean;
  /** Song id → semitones, for the songs someone transposed. */
  transpose: Record<number, number>;
};

export const FONT_SCALES = [0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];

let prefs: Prefs = {
  fontScale: readLocalJson('fontScale', 1),
  showChords: readLocalJson('showChords', true),
  // Off by default: the song's own diagrams are for the few who need an unusual voicing (D84).
  showDiagrams: readLocalJson('showDiagrams', false),
  showColumns: readLocalJson('showColumns', true),
  transpose: readLocalJson('transpose', {}),
};
const listeners = new Set<() => void>();

function update(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePrefs() {
  const state = useSyncExternalStore(subscribe, () => prefs);

  const stepFont = useCallback((direction: 1 | -1) => {
    const i = FONT_SCALES.indexOf(prefs.fontScale);
    const next =
      FONT_SCALES[
        Math.max(0, Math.min(FONT_SCALES.length - 1, (i === -1 ? 2 : i) + direction))
      ] ?? 1;
    writeLocalJson('fontScale', next);
    update({ fontScale: next });
  }, []);

  const setShowChords = useCallback((showChords: boolean) => {
    writeLocalJson('showChords', showChords);
    update({ showChords });
  }, []);

  const setShowDiagrams = useCallback((showDiagrams: boolean) => {
    writeLocalJson('showDiagrams', showDiagrams);
    update({ showDiagrams });
  }, []);

  const setShowColumns = useCallback((showColumns: boolean) => {
    writeLocalJson('showColumns', showColumns);
    update({ showColumns });
  }, []);

  const setTranspose = useCallback((songId: number, semitones: number) => {
    // Kept between -11 and +11; 0 is not stored at all.
    const normalized = semitones % 12;
    const transpose = { ...prefs.transpose };
    if (normalized === 0) {
      delete transpose[songId];
    } else {
      transpose[songId] = normalized;
    }
    writeLocalJson('transpose', transpose);
    update({ transpose });
  }, []);

  return {
    ...state,
    stepFont,
    setShowChords,
    setShowDiagrams,
    setShowColumns,
    setTranspose,
  };
}
