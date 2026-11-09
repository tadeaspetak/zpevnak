import type { Knex } from 'knex';
import type { SessionUser } from '../auth/sessions.ts';
import { fail } from '../trpc/trpc.ts';

export type PlaylistRole = 'owner' | 'collaborator';

type PlaylistRow = {
  id: number;
  owner_id: number;
  owner_name: string;
  name: string;
  is_public: boolean;
  updated_at: Date;
  song_ids: number[];
  collaborator_count: number;
  is_collaborator: boolean;
};

const PLAYLIST_SELECT = /* sql */ `
  SELECT p.id, p.owner_id, u.display_name AS owner_name, p.name, p.is_public, p.updated_at,
         coalesce(
           array_agg(ps.song_id ORDER BY ps.position) FILTER (WHERE ps.song_id IS NOT NULL),
           '{}'
         ) AS song_ids,
         (SELECT count(*)::int FROM playlist_collaborators c WHERE c.playlist_id = p.id)
           AS collaborator_count,
         EXISTS (
           SELECT 1 FROM playlist_collaborators c
           WHERE c.playlist_id = p.id AND c.user_id = :viewerId
         ) AS is_collaborator
  FROM playlists p
  JOIN users u ON u.id = p.owner_id
  LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
`;

function roleOf(row: PlaylistRow, viewer: SessionUser | null): PlaylistRole | null {
  if (row.owner_id === viewer?.id) {
    return 'owner';
  }
  return row.is_collaborator ? 'collaborator' : null;
}

/**
 * The playlist as the client gets it. An allow-list: never spread a row here. The invite token
 * is deliberately absent: it would sync to every collaborator's device; the owner fetches it
 * on its own (`playlists.invite`).
 */
function toPlaylistRecord(row: PlaylistRow, viewer: SessionUser | null) {
  const role = roleOf(row, viewer);
  return {
    id: row.id,
    name: row.name,
    isPublic: row.is_public,
    ownerName: row.owner_name,
    role,
    // Who works on a playlist is its own people's business: null to anyone else (D79).
    collaboratorCount: role ? row.collaborator_count : null,
    songIds: row.song_ids.map(Number),
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
export async function assertMember(db: Knex, id: number, viewer: SessionUser) {
  const playlist = await loadVisiblePlaylist(db, id, viewer);
  if (!playlist.role) {
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
