import type { Knex } from 'knex';
import { editsAsMember, type JoinRole, type MemberRole } from '#shared/roles.ts';
import type { SessionUser } from '../auth/sessions.ts';
import { SONG_READABLE } from '../songs/record.ts';
import { fail } from '../trpc/trpc.ts';

type PlaylistRow = {
  id: number;
  owner_id: number;
  owner_name: string;
  name: string;
  is_public: boolean;
  updated_at: Date;
  song_ids: number[];
  listmate_count: number;
  /** The viewer's role if they joined; null if they didn't (or own it). */
  joined_role: JoinRole | null;
  song_keys: Record<string, { semitones: number; from: number | null }>;
};

const PLAYLIST_SELECT = /* sql */ `
  SELECT p.id, p.owner_id, u.display_name AS owner_name, p.name, p.is_public, p.updated_at,
         -- Only the songs the viewer may read: someone outside the playlist doesn't learn of a
         -- private song in it, not even that one is there (D128). Its people read them all.
         coalesce(
           array_agg(ps.song_id ORDER BY ps.position)
             FILTER (WHERE ps.song_id IS NOT NULL AND ${SONG_READABLE}),
           '{}'
         ) AS song_ids,
         (SELECT count(*)::int FROM playlist_collaborators c WHERE c.playlist_id = p.id)
           AS listmate_count,
         (
           SELECT c.role FROM playlist_collaborators c
           WHERE c.playlist_id = p.id AND c.user_id = :viewerId
         ) AS joined_role,
         -- The keys it plays its songs in (D131), for the songs the viewer may read only.
         (
           SELECT coalesce(
             json_object_agg(
               k.song_id,
               json_build_object('semitones', k.semitones, 'from', k.from_pitch)
             ),
             '{}'
           )
           FROM playlist_song_keys k JOIN songs s ON s.id = k.song_id
           WHERE k.playlist_id = p.id AND ${SONG_READABLE}
         ) AS song_keys
  FROM playlists p
  JOIN users u ON u.id = p.owner_id
  LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
  LEFT JOIN songs s ON s.id = ps.song_id
`;

function roleOf(row: PlaylistRow, viewer: SessionUser | null): MemberRole | null {
  if (row.owner_id === viewer?.id) {
    return 'owner';
  }
  return row.joined_role;
}

/**
 * The playlist as the client gets it. An allow-list: never spread a row here. The invite token
 * is deliberately absent: it would sync to every collaborator's device; the owner fetches it
 * on its own (`sharing.invite`).
 */
function toPlaylistRecord(row: PlaylistRow, viewer: SessionUser | null) {
  const role = roleOf(row, viewer);
  return {
    id: row.id,
    name: row.name,
    isPublic: row.is_public,
    ownerName: row.owner_name,
    role,
    // Who is in a playlist is its own people's business: null to anyone else (D79). Everyone
    // it is shared with, readers too.
    listmateCount: role ? row.listmate_count : null,
    songIds: row.song_ids.map(Number),
    /** Song id → the key this playlist plays it in, where not the song's own (D131). */
    songKeys: Object.fromEntries(
      Object.entries(row.song_keys).map(([songId, key]) => [
        Number(songId),
        { semitones: key.semitones, from: key.from },
      ]),
    ) as Record<number, { semitones: number; from: number | null }>,
    updatedAt: row.updated_at.toISOString(),
  };
}
export type PlaylistRecord = ReturnType<typeof toPlaylistRecord>;

/** Every playlist the viewer may open: their own, those they collaborate on, public ones. */
export async function loadVisiblePlaylists(db: Knex, viewer: SessionUser | null) {
  const { rows } = await db.raw<{ rows: PlaylistRow[] }>(
    /* sql */ `
      ${PLAYLIST_SELECT}
      WHERE p.is_public OR p.owner_id = :viewerId OR EXISTS (
        SELECT 1 FROM playlist_collaborators c
        WHERE c.playlist_id = p.id AND c.user_id = :viewerId
      )
      GROUP BY p.id, u.display_name
      ORDER BY p.updated_at DESC
    `,
    { viewerId: viewer?.id ?? null },
  );
  return rows.map((r) => toPlaylistRecord(r, viewer));
}

/** A private playlist answers NOT_FOUND to anyone outside it, so it doesn't leak. */
export async function loadVisiblePlaylist(
  db: Knex,
  id: number,
  viewer: SessionUser | null,
) {
  const { rows } = await db.raw<{ rows: PlaylistRow[] }>(
    /* sql */ `${PLAYLIST_SELECT} WHERE p.id = :id GROUP BY p.id, u.display_name`,
    { id, viewerId: viewer?.id ?? null },
  );
  const row = rows[0];
  const record = row ? toPlaylistRecord(row, viewer) : null;
  if (!record || (!record.isPublic && !record.role)) {
    fail('NOT_FOUND', 'NOT_FOUND');
  }
  return record;
}

/** Owner or collaborator: may change the songs and the name. */
export async function assertCanEdit(db: Knex, id: number, viewer: SessionUser) {
  const playlist = await loadVisiblePlaylist(db, id, viewer);
  if (!editsAsMember(playlist.role)) {
    fail('FORBIDDEN', 'FORBIDDEN');
  }
  return playlist;
}

/** Only the owner deletes, changes visibility and manages who collaborates. */
export async function assertOwner(db: Knex, id: number, viewer: SessionUser) {
  const playlist = await loadVisiblePlaylist(db, id, viewer);
  if (playlist.role !== 'owner') {
    fail('FORBIDDEN', 'FORBIDDEN');
  }
  return playlist;
}
