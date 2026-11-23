import type { Knex } from 'knex';
import type { SessionUser } from '../auth/sessions.ts';
import { inSearch } from '#shared/songs.ts';
import { SONG_READABLE, type SongRow } from '../songs/record.ts';
import { fail } from '../trpc/trpc.ts';

/**
 * Where the songs are going: a playlist that exists (its people as they are now), or a new one
 * of `user`'s, public or not.
 */
type Target = { playlistId: number } | { newPlaylistIsPublic: boolean };

/**
 * Refuses songs the user can't find (unknown, someone else's rejected: D77, or a private one
 * they may not read: D127), and a private song in a playlist where anyone couldn't already read
 * it: someone the playlist is shared with, or anybody at all for a public one.
 */
export async function assertSongsUsable(
  trx: Knex | Knex.Transaction,
  songIds: number[],
  user: SessionUser,
  target: Target,
): Promise<void> {
  const unique = [...new Set(songIds)];
  if (unique.length === 0) {
    return;
  }
  const playlistId = 'playlistId' in target ? target.playlistId : null;
  const isPublic =
    'playlistId' in target
      ? (
          await trx.raw(/* sql */ `SELECT is_public FROM playlists WHERE id = :id`, {
            id: target.playlistId,
          })
        ).rows[0].is_public
      : target.newPlaylistIsPublic;
  const { rows } = await trx.raw<{
    rows: (Pick<SongRow, 'id' | 'status' | 'created_by'> & {
      readable: boolean;
      read_by_all: boolean;
    })[];
  }>(
    /* sql */ `
      SELECT s.id, s.status, s.created_by, ${SONG_READABLE} AS readable,
             NOT EXISTS (
               SELECT 1 FROM (
                 SELECT p.owner_id AS user_id FROM playlists p WHERE p.id = :playlistId
                 UNION
                 SELECT c.user_id FROM playlist_collaborators c WHERE c.playlist_id = :playlistId
               ) people
               WHERE people.user_id IS DISTINCT FROM s.created_by AND NOT EXISTS (
                 SELECT 1 FROM song_members m
                 WHERE m.song_id = s.id AND m.user_id = people.user_id
               )
             ) AS read_by_all
      FROM songs s WHERE s.id = ANY(:ids)
    `,
    { ids: unique, viewerId: user.id, playlistId },
  );
  const findable = rows.filter(
    (r) => r.readable && inSearch({ status: r.status, createdBy: r.created_by }, user.id),
  );
  if (findable.length !== unique.length) {
    fail('BAD_REQUEST', 'NOT_FOUND');
  }
  if (rows.some((r) => r.status === 'private' && (isPublic || !r.read_by_all))) {
    fail('BAD_REQUEST', 'PRIVATE_SONG_NOT_SHARED');
  }
}

/** Replaces the playlist's songs with `songIds`, in that order. */
export async function writeSongs(
  trx: Knex.Transaction,
  playlistId: number,
  songIds: number[],
): Promise<void> {
  await trx.raw(/* sql */ `DELETE FROM playlist_songs WHERE playlist_id = :playlistId`, {
    playlistId,
  });
  if (songIds.length > 0) {
    await trx.raw(
      /* sql */ `
        INSERT INTO playlist_songs (playlist_id, position, song_id)
        SELECT :playlistId, ord::int, song_id
        FROM unnest(:songIds::bigint[]) WITH ORDINALITY AS t(song_id, ord)
      `,
      { playlistId, songIds },
    );
  }
}
