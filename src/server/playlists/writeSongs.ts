import type { Knex } from 'knex';
import type { SessionUser } from '../auth/sessions.ts';
import { inSearch } from '#shared/songs.ts';
import { readablePrivateSongIds, SONG_READABLE, type SongRow } from '../songs/record.ts';
import { fail } from '../trpc/trpc.ts';

/**
 * Refuses songs the user can't find (unknown, someone else's rejected: D77, or a private one
 * they may not read: D127). And a private song where it would reach someone new: a playlist
 * shares its songs with its people (D128), so only the song's owner may put it where anyone in
 * the playlist can't read it yet. Anyone else who reads it may add it where all of them can.
 * `playlistId` null is a new playlist of the user's, who is then its only person.
 */
export async function assertSongsUsable(
  trx: Knex | Knex.Transaction,
  songIds: number[],
  user: SessionUser,
  playlistId: number | null,
): Promise<void> {
  const unique = [...new Set(songIds)];
  if (unique.length === 0) {
    return;
  }
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
               WHERE s.id NOT IN (${readablePrivateSongIds('people.user_id')})
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
  const passesOn = rows.some(
    (r) => r.status === 'private' && r.created_by !== user.id && !r.read_by_all,
  );
  if (passesOn) {
    fail('BAD_REQUEST', 'PRIVATE_SONG_NOT_SHARED');
  }
}

/**
 * Replaces the playlist's songs with `songIds`, in that order. A song that left the playlist
 * takes its key there with it (D131).
 */
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
  await trx.raw(
    /* sql */ `
      DELETE FROM playlist_song_keys
      WHERE playlist_id = :playlistId AND NOT (song_id = ANY(:songIds::bigint[]))
    `,
    { playlistId, songIds },
  );
}
