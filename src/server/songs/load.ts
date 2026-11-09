import type { Knex } from 'knex';
import type { SessionUser } from '../auth/sessions.ts';
import { fail } from '../trpc/trpc.ts';
import { SONG_COLUMNS, toSongRecord } from './record.ts';

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

/** The song as `viewer` gets it. Anyone may open any song, a rejected one too (D77). */
export async function loadSong(db: Knex, id: number, viewer: SessionUser | null) {
  return toSongRecord(await loadSongRow(db, id), viewer);
}
