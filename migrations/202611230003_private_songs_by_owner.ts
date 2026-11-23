import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    -- Each sync reads the viewer's own private songs; songs had no index by author.
    CREATE INDEX songs_private_created_by_idx ON songs (created_by) WHERE status = 'private';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `DROP INDEX songs_private_created_by_idx;`);
}
