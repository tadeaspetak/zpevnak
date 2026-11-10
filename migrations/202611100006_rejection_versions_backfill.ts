import type { Knex } from 'knex';

// Its own migration: Postgres can't use an enum value in the transaction that added it.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    -- Songs rejected now get their rejection as a version, so fixing them shows as a fix.
    INSERT INTO song_versions
      (song_id, kind, source, title, artist, saved_by, saved_at, rejection_reason, rejection_note)
    SELECT id, 'reject', source, title, artist, reviewed_by, COALESCE(reviewed_at, updated_at),
           rejection_reason, rejection_note
    FROM songs
    WHERE status = 'rejected'
    ORDER BY id;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `DELETE FROM song_versions WHERE kind = 'reject';`);
}
