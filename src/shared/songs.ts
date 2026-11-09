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
