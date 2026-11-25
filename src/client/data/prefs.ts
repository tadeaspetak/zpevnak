/** How the player likes songs shown, per device. */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { Instrument } from '#shared/chordpro/shapes.ts';
import { type KeyShift } from '#shared/chordpro/transpose.ts';
import { readLocalJson, writeLocalJson } from './local.ts';

type Prefs = {
  fontScale: number;
  /** Chords above the lyrics; off to just sing along. */
  showChords: boolean;
  showDiagrams: boolean;
  /** Notes on songs (D135); off to play from a clean sheet. */
  showNotes: boolean;
  /** Whose chord diagrams (D132). */
  instrument: Instrument;
  /** Song id → how far it's transposed, for the songs someone transposed. */
  transpose: Record<number, KeyShift>;
};

export const FONT_SCALES = [0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];

/**
 * The text size a pinch comes to: the size it started from, times how far the fingers spread
 * (`ratio`), snapped to the nearest of `FONT_SCALES` and kept within them.
 */
export function pinchedScale(start: number, ratio: number): number {
  const wanted = start * ratio;
  return FONT_SCALES.reduce((best, scale) =>
    Math.abs(scale - wanted) < Math.abs(best - wanted) ? scale : best,
  );
}

let prefs: Prefs = {
  fontScale: readLocalJson('fontScale', 1),
  showChords: readLocalJson('showChords', true),
  // Off by default: the song's own diagrams are for the few who need an unusual voicing (D84).
  showDiagrams: readLocalJson('showDiagrams', false),
  showNotes: readLocalJson('showNotes', true),
  instrument: readLocalJson<Instrument>('instrument', 'guitar'),
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

  /** One of `FONT_SCALES`, as a pinch arrives at it. */
  const setFontScale = useCallback((fontScale: number) => {
    if (fontScale !== prefs.fontScale) {
      writeLocalJson('fontScale', fontScale);
      update({ fontScale });
    }
  }, []);

  const setShowChords = useCallback((showChords: boolean) => {
    writeLocalJson('showChords', showChords);
    update({ showChords });
  }, []);

  const setShowDiagrams = useCallback((showDiagrams: boolean) => {
    writeLocalJson('showDiagrams', showDiagrams);
    update({ showDiagrams });
  }, []);

  const setShowNotes = useCallback((showNotes: boolean) => {
    writeLocalJson('showNotes', showNotes);
    update({ showNotes });
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

  const setInstrument = useCallback((instrument: Instrument) => {
    writeLocalJson('instrument', instrument);
    update({ instrument });
  }, []);

  return {
    ...state,
    setInstrument,
    stepFont,
    setFontScale,
    setShowChords,
    setShowDiagrams,
    setShowNotes,
    setTranspose,
  };
}

/**
 * Gives a transposition saved as semitones alone (before D119 kept the starting pitch) the pitch
 * the song has now, the first time it is open with one. From then on a key saved for everyone
 * moves it right; left bare, "+3" would land on top of the new key. A song that has gone through
 * a saved key before this first visit can't be told apart, and keeps its old offset.
 */
export function usePinnedTranspose(songId: number | null, pitch: number | null) {
  const { transpose, setTranspose } = usePrefs();
  const stored = songId === null ? undefined : transpose[songId];
  useEffect(() => {
    if (songId !== null && typeof stored === 'number' && pitch !== null) {
      setTranspose(songId, stored, pitch);
    }
  }, [songId, stored, pitch, setTranspose]);
}
