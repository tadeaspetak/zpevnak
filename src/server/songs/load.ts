import type { Knex } from 'knex';
import type { SessionUser } from '../auth/sessions.ts';
import { fail } from '../trpc/trpc.ts';
import { SONG_COLUMNS, type SongRow, toSongRecord } from './record.ts';

/**
 * The song's row, or NOT_FOUND. Pass a transaction and `forUpdate` to lock it before deciding
 * anything from it: two saves of one song then take turns instead of overwriting each other.
 */
export async function loadSongRow(db: Knex, id: number, { forUpdate = false } = {}) {
  const { rows } = await db.raw(
    /* sql */ `SELECT ${SONG_COLUMNS} FROM songs s WHERE s.id = :id ${forUpdate ? 'FOR UPDATE' : ''}`,
    { id },
  );
  const row = rows[0];
  if (!row) {
    fail('NOT_FOUND', 'NOT_FOUND');
  }
  return row;
}

/**
 * Refuses a change to a song that changed after `seenAt`, when the person last saw it: someone
 * else saved, approved or rejected it meanwhile (D106). Call it on the locked row.
 */
export function assertUnchanged(row: SongRow, seenAt: string) {
  if (row.updated_at.toISOString() !== seenAt) {
    fail('CONFLICT', 'SONG_CHANGED');
  }
}

/** The song as `viewer` gets it. Anyone may open any song, a rejected one too (D77). */
export async function loadSong(db: Knex, id: number, viewer: SessionUser | null) {
  return toSongRecord(await loadSongRow(db, id), viewer);
}
