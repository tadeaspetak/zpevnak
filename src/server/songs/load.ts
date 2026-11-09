import type { Knex } from 'knex';
import type { SessionUser } from '../auth/sessions.ts';
import { fail } from '../trpc/trpc.ts';
import { canSeeSong, SONG_COLUMNS, toSongRecord } from './record.ts';

export async function loadSongRow(db: Knex, id: number) {
  const { rows } = await db.raw(
    /* sql */ `SELECT ${SONG_COLUMNS} FROM songs s WHERE s.id = :id`,
    {
      id,
    },
  );
  const row = rows[0];
  if (!row) {
    fail('NOT_FOUND', 'NOT_FOUND');
  }
  return row;
}

/** The song as `viewer` may see it; NOT_FOUND when they may not, so its existence doesn't leak. */
export async function loadVisibleSong(db: Knex, id: number, viewer: SessionUser | null) {
  const row = await loadSongRow(db, id);
  if (!canSeeSong(row, viewer)) {
    fail('NOT_FOUND', 'NOT_FOUND');
  }
  return toSongRecord(row, viewer);
}
