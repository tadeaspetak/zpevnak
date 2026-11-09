import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    -- A deleted song's row is gone (and with it its place in every playlist); this remembers
    -- that it went, so every device drops its copy on its next sync.
    CREATE TABLE song_deletions (
      song_id bigint PRIMARY KEY,
      deleted_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX song_deletions_deleted_at_idx ON song_deletions (deleted_at);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `DROP TABLE song_deletions;`);
}
