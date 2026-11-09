import type { Knex } from 'knex';
import type { SessionUser } from '../auth/sessions.ts';
import { inSearch } from '#shared/songs.ts';
import type { SongRow } from '../songs/record.ts';
import { fail } from '../trpc/trpc.ts';

/** Refuses songs the user can't find (unknown, or someone else's rejected: D77). */
export async function assertSongsUsable(
  trx: Knex | Knex.Transaction,
  songIds: number[],
  user: SessionUser,
): Promise<void> {
  const unique = [...new Set(songIds)];
  if (unique.length === 0) {
    return;
  }
  const { rows } = await trx.raw<{
    rows: Pick<SongRow, 'id' | 'status' | 'created_by'>[];
  }>(/* sql */ `SELECT id, status, created_by FROM songs WHERE id = ANY(:ids)`, {
    ids: unique,
  });
  const findable = rows.filter((r) =>
    inSearch({ status: r.status, createdBy: r.created_by }, user.id),
  );
  if (findable.length !== unique.length) {
    fail('BAD_REQUEST', 'NOT_FOUND');
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
