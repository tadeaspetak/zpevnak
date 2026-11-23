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
  /** Song id → how far it's transposed, for the songs someone transposed. */
  transpose: Record<number, StoredTranspose>;
};

/**
 * Semitones, and the pitch the song started from when they were set (`songPitch`). Saved from
 * before that pitch was kept: semitones alone.
 */
type StoredTranspose = number | { semitones: number; from: number };

/**
 * How far to transpose a song that now starts from `from`. Saved in another key since (D119),
 * the song keeps sounding where the player put it: "+3 from A" is "±0" once the text is in C.
 */
export function semitonesFor(
  stored: StoredTranspose | undefined,
  from: number | null,
): number {
  if (stored === undefined) {
    return 0;
  }
  if (typeof stored === 'number') {
    return stored;
  }
  if (from === null || from === stored.from) {
    return stored.semitones;
  }
  // The nearer way round: −5 rather than +7.
  const moved = (((stored.semitones + stored.from - from) % 12) + 12) % 12;
  return moved > 6 ? moved - 12 : moved;
}

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

  /** `from`: the pitch the song starts from as it is now (`songPitch`). */
  const setTranspose = useCallback(
    (songId: number, semitones: number, from: number | null) => {
      // Kept between -11 and +11; 0 is not stored at all.
      const normalized = semitones % 12;
      const transpose = { ...prefs.transpose };
      if (normalized === 0) {
        delete transpose[songId];
      } else {
        transpose[songId] = from === null ? normalized : { semitones: normalized, from };
      }
      writeLocalJson('transpose', transpose);
      update({ transpose });
    },
    [],
  );

  return {
    ...state,
    stepFont,
    setShowChords,
    setShowDiagrams,
    setShowColumns,
    setTranspose,
  };
}
