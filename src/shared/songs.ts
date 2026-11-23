import { editsAsMember, type MemberRole } from './roles.ts';
import type { SongStatus } from './validators/index.ts';

/**
 * Whether a song can be found: in search and the song lists, and added to a playlist. A
 * rejected song can't, except by its author, who has to find it to fix it. It stays wherever it
 * already is, though: in playlists and behind its link, marked rejected (D77). A private song
 * reaches only those who may read it, and for them it is like any other (D127).
 */
export function inSearch(
  song: { status: SongStatus; createdBy: number | null },
  viewerId: number | null,
): boolean {
  return song.status !== 'rejected' || (viewerId !== null && song.createdBy === viewerId);
}

/** A song as these rules need it: its review status, author, and the viewer's role in it. */
type SongAccess = {
  status: SongStatus;
  createdBy: number | null;
  role: MemberRole | null;
};

type Viewer = { id: number; role: 'user' | 'editor' | 'admin'; emailVerified: boolean };

/** An editor or an admin: they review songs and may change any of them. */
export function isEditor(user: Pick<Viewer, 'role'> | null): boolean {
  return user?.role === 'editor' || user?.role === 'admin';
}

/**
 * Who may edit a song (D78, D81), the same on both sides: editors any public song; its author
 * while it isn't approved (an approved song belongs to the songbook). A private song only its
 * owner and the people it is shared with to edit, never the songbook's editors (D127). Always
 * with a confirmed email.
 */
export function canChangeSong(user: Viewer | null, song: SongAccess): boolean {
  if (!user?.emailVerified) {
    return false;
  }
  if (song.status === 'private') {
    return editsAsMember(song.role);
  }
  return isEditor(user) || (song.createdBy === user.id && song.status !== 'verified');
}

/** Who may delete a song: whoever may change a public one (D78); a private one, its owner. */
export function canDeleteSong(user: Viewer | null, song: SongAccess): boolean {
  if (song.status === 'private') {
    return Boolean(user?.emailVerified) && song.role === 'owner';
  }
  return canChangeSong(user, song);
}
