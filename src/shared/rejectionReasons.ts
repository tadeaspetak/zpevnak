import type { Locale, RejectionReason } from './validators/index.ts';

/**
 * Why a song was turned down, as people read it: in the app and in the email to its author, so
 * the two can't drift apart (the client's dictionaries take theirs from here).
 */
export const REJECTION_REASON_LABELS: Record<Locale, Record<RejectionReason, string>> = {
  cs: {
    too_many_mistakes: 'příliš mnoho chyb',
    totally_wrong: 'úplně špatně',
    duplicate: 'už tu je',
    other: 'jiný důvod',
  },
  en: {
    too_many_mistakes: 'too many mistakes',
    totally_wrong: 'totally wrong',
    duplicate: 'already here',
    other: 'other reason',
  },
};
