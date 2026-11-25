import type { NoteSystem } from '#shared/chordpro/chord.ts';
import { useI18n } from '../i18n/index.tsx';

/**
 * How this reader spells chords (D132): by the app's language, H in Czech, where B natural is
 * H, and B in English. No setting of its own: the owner's call, until someone needs one.
 */
export function useNotation(): NoteSystem {
  const { locale } = useI18n();
  return locale === 'cs' ? 'german' : 'common';
}
