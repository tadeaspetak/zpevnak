import { z } from 'zod';

export const LOCALES = ['cs', 'en'] as const;
export const localeSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof localeSchema>;

export const ROLES = ['user', 'editor', 'admin'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export type SongStatus = 'pending' | 'verified' | 'rejected';

export const REJECTION_REASONS = [
  'too_many_mistakes',
  'totally_wrong',
  'duplicate',
  'other',
] as const;
export const rejectionReasonSchema = z.enum(REJECTION_REASONS);
export type RejectionReason = z.infer<typeof rejectionReasonSchema>;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email())
  .pipe(z.string().max(254));

/** Length only: a long passphrase beats any composition rule. */
export const PASSWORD_MIN = 10;
export const passwordSchema = z.string().min(PASSWORD_MIN).max(200);

export const displayNameSchema = z.string().trim().min(1).max(60);

export const idSchema = z.number().int().positive();

/** ChordPro source. 100 kB is ~50× the longest song in the songbook. */
export const songSourceSchema = z.string().max(100_000);

export const playlistNameSchema = z.string().trim().min(1).max(100);

export const tokenSchema = z.string().min(20).max(200);

/**
 * When the client last saw a song (its `updatedAt`): a change to the song is refused if the song
 * has moved on since, so nobody saves, approves or rejects text they haven't seen (D106).
 */
export const seenAtSchema = z.iso.datetime();

/** A playlist invite link's secret. */
export const inviteTokenSchema = z.string().min(16).max(64);

/** The most songs a playlist holds: a long evening, with room to spare. */
export const PLAYLIST_MAX_SONGS = 500;

/**
 * A path inside the app to return to after signing in or confirming an email. Only a local
 * path: "/" first, never "//" (another host) or a backslash (which browsers read as "/").
 */
export const appPathSchema = z
  .string()
  .max(500)
  .refine((p) => p.startsWith('/') && !p.startsWith('//') && !p.includes('\\'));

/** `appPathSchema`, as a check for the client: the path, or null if it isn't a local one. */
export function safeAppPath(path: string | null | undefined): string | null {
  return path && appPathSchema.safeParse(path).success ? path : null;
}
