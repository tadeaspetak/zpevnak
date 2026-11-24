import type { NoteSystem } from '#shared/chordpro/chord.ts';
import { usePrefs } from '../data/prefs.ts';
import { useI18n } from '../i18n/index.tsx';

/**
 * How this reader spells chords (D132): as they chose, or by the app's language: H in Czech,
 * where B natural is H, and B in English.
 */
export function useNotation(): NoteSystem {
  const { notation } = usePrefs();
  const { locale } = useI18n();
  return notation ?? (locale === 'cs' ? 'german' : 'common');
}
