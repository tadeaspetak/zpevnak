import type { MemberRole } from '#shared/roles.ts';
import type { RejectionReason, SongStatus } from '#shared/validators/index.ts';
import { isEditor } from '#shared/songs.ts';
import type { SessionUser } from '../auth/sessions.ts';

/**
 * Columns every song read selects, for `toSongRecord`, with the viewer's role in the song: its
 * owner (the author), or as it was shared with them. Reading it through a playlist is no role
 * (D128): it gives no say in the song. Binds `:viewerId` (null: signed out).
 */
export const SONG_COLUMNS = /* sql */ `
  s.id, s.title, s.artist, s.source, s.status, s.rejection_reason, s.rejection_note,
  s.created_by, s.created_at, s.updated_at,
  CASE WHEN s.created_by = :viewerId THEN 'owner'
       ELSE (SELECT m.role FROM song_members m WHERE m.song_id = s.id AND m.user_id = :viewerId)
  END AS viewer_role
`;

/**
 * The private songs the viewer may read, worked out from the viewer's side (what they own, what
 * is shared with them, the playlists they are in), so it costs what they can see, not the whole
 * catalog: their own (D127), those shared with them (D127), and every one in a playlist they are
 * in, in any role (D128). Nobody else, the songbook's editors included. Binds `:viewerId`; for
 * nobody signed in it is empty.
 */
export const READABLE_PRIVATE_SONG_IDS = readablePrivateSongIds(':viewerId');

/**
 * The same for someone else than the viewer: `who` is a SQL expression for their user id (a
 * column of the surrounding query). Written into SQL: constants, never input.
 */
export function readablePrivateSongIds(who: ':viewerId' | `${string}.user_id`): string {
  return /* sql */ `
    SELECT own.id FROM songs own WHERE own.created_by = ${who} AND own.status = 'private'
    UNION
    SELECT m.song_id FROM song_members m WHERE m.user_id = ${who}
    UNION
    SELECT ps.song_id FROM playlist_songs ps
    WHERE ps.playlist_id IN (
      SELECT p.id FROM playlists p WHERE p.owner_id = ${who}
      UNION
      SELECT c.playlist_id FROM playlist_collaborators c WHERE c.user_id = ${who}
    )
  `;
}

/**
 * Whether the viewer may read song `s` at all: a public song anyone, a private one only those
 * `READABLE_PRIVATE_SONG_IDS` names. For anyone else it doesn't exist. Binds `:viewerId`.
 */
export const SONG_READABLE = /* sql */ `
  (s.status <> 'private' OR s.id IN (${READABLE_PRIVATE_SONG_IDS}))
`;

export type SongRow = {
  id: number;
  title: string;
  artist: string | null;
  source: string;
  status: SongStatus;
  rejection_reason: RejectionReason | null;
  rejection_note: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
  viewer_role: MemberRole | null;
};

/** The song as the client gets it. An allow-list: never spread a row here. */
export function toSongRecord(row: SongRow, viewer: SessionUser | null) {
  const seesRejection = row.created_by === viewer?.id || isEditor(viewer);
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    source: row.source,
    status: row.status,
    rejection:
      seesRejection && row.rejection_reason
        ? { reason: row.rejection_reason, note: row.rejection_note }
        : null,
    createdBy: row.created_by,
    /** The viewer's role in the song: owner (its author) or as shared with them; null if neither. */
    role: row.viewer_role,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
export type SongRecord = ReturnType<typeof toSongRecord>;
