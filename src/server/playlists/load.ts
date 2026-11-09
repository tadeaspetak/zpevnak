import type { Knex } from 'knex';
import type { SessionUser } from '../auth/sessions.ts';
import { fail } from '../trpc/trpc.ts';

type PlaylistRow = {
  id: number;
  owner_id: number;
  owner_name: string;
  name: string;
  is_public: boolean;
  updated_at: Date;
  song_ids: number[];
};

const PLAYLIST_SELECT = /* sql */ `
  SELECT p.id, p.owner_id, u.display_name AS owner_name, p.name, p.is_public, p.updated_at,
         coalesce(
           array_agg(ps.song_id ORDER BY ps.position) FILTER (WHERE ps.song_id IS NOT NULL),
           '{}'
         ) AS song_ids
  FROM playlists p
  JOIN users u ON u.id = p.owner_id
  LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
`;

/** The playlist as the client gets it. An allow-list: never spread a row here. */
function toPlaylistRecord(row: PlaylistRow, viewer: SessionUser | null) {
  return {
    id: row.id,
    name: row.name,
    isPublic: row.is_public,
    ownerName: row.owner_name,
    isMine: row.owner_id === viewer?.id,
    songIds: row.song_ids.map(Number),
    updatedAt: row.updated_at.toISOString(),
  };
}
export type PlaylistRecord = ReturnType<typeof toPlaylistRecord>;

/** The viewer's own playlists and everyone's public ones. */
export async function loadVisiblePlaylists(db: Knex, viewer: SessionUser | null) {
  const { rows } = await db.raw<{ rows: PlaylistRow[] }>(
    /* sql */ `
      ${PLAYLIST_SELECT}
      WHERE p.is_public OR p.owner_id = :viewerId
      GROUP BY p.id, u.display_name
      ORDER BY p.updated_at DESC
    `,
    { viewerId: viewer?.id ?? null },
  );
  return rows.map((r) => toPlaylistRecord(r, viewer));
}

/** A private playlist answers NOT_FOUND to anyone but its owner, so it doesn't leak. */
export async function loadVisiblePlaylist(
  db: Knex,
  id: number,
  viewer: SessionUser | null,
) {
  const { rows } = await db.raw<{ rows: PlaylistRow[] }>(
    /* sql */ `${PLAYLIST_SELECT} WHERE p.id = :id GROUP BY p.id, u.display_name`,
    { id },
  );
  const row = rows[0];
  if (!row || (!row.is_public && row.owner_id !== viewer?.id)) {
    fail('NOT_FOUND', 'NOT_FOUND');
  }
  return toPlaylistRecord(row, viewer);
}

export async function assertOwnPlaylist(db: Knex, id: number, viewer: SessionUser) {
  const playlist = await loadVisiblePlaylist(db, id, viewer);
  if (!playlist.isMine) {
    fail('FORBIDDEN', 'FORBIDDEN');
  }
  return playlist;
}
