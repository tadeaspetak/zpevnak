import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    -- Who was taken out of a playlist, and when: an owner's removal can be undone for a short
    -- while (D87), and only someone who really was in the playlist can be put back.
    CREATE TABLE playlist_collaborator_removals (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      playlist_id bigint NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
      user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      joined_at timestamptz NOT NULL,
      removed_at timestamptz NOT NULL DEFAULT now(),
      restored_at timestamptz
    );
    CREATE INDEX playlist_collaborator_removals_playlist_user_idx
      ON playlist_collaborator_removals (playlist_id, user_id, removed_at);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `DROP TABLE playlist_collaborator_removals;`);
}
