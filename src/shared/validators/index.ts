import { z } from 'zod';

export const LOCALES = ['cs', 'en'] as const;
export const localeSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof localeSchema>;

export const ROLES = ['user', 'editor', 'admin'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const SONG_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type SongStatus = (typeof SONG_STATUSES)[number];

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
