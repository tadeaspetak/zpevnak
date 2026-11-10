/**
 * Error codes the server sends as a TRPCError's message. The client translates them; the
 * server never sends user-facing prose.
 */
const ERROR_CODES = [
  'INVALID_CREDENTIALS',
  'EMAIL_NOT_VERIFIED',
  'INVALID_TOKEN',
  'NOT_SIGNED_IN',
  'FORBIDDEN',
  'NOT_FOUND',
  'SONG_HAS_NO_TITLE',
  'SONG_NOT_EDITABLE',
  'CANNOT_CHANGE_OWN_ROLE',
  'TOO_MANY_REQUESTS',
  'UNDO_EXPIRED',
  'REJECTION_NOTE_REQUIRED',
  'PLAYLIST_FULL',
  'SONG_CHANGED',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
