import type { SongStatus } from './validators/index.ts';

/**
 * Whether a song can be found: in search and the song lists, and added to a playlist. A
 * rejected song can't, except by its author, who has to find it to fix it. It stays wherever it
 * already is, though: in playlists and behind its link, marked rejected (D77).
 */
export function inSearch(
  song: { status: SongStatus; createdBy: number | null },
  viewerId: number | null,
): boolean {
  return song.status !== 'rejected' || (viewerId !== null && song.createdBy === viewerId);
}

type Viewer = { id: number; role: 'user' | 'editor' | 'admin'; emailVerified: boolean };

/** An editor or an admin: they review songs and may change any of them. */
export function isEditor(user: Pick<Viewer, 'role'> | null): boolean {
  return user?.role === 'editor' || user?.role === 'admin';
}

/**
 * Who may edit or delete a song (D78, D81), the same on both sides: editors any song; its
 * author while it isn't approved (an approved song belongs to the songbook). Always with a
 * confirmed email.
 */
export function canChangeSong(
  user: Viewer | null,
  song: { status: SongStatus; createdBy: number | null },
): boolean {
  if (!user?.emailVerified) {
    return false;
  }
  return isEditor(user) || (song.createdBy === user.id && song.status !== 'verified');
}
