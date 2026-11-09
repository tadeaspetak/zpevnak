import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    -- Who besides the owner may edit a playlist's songs and name.
    CREATE TABLE playlist_collaborators (
      playlist_id bigint NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
      user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      joined_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (playlist_id, user_id)
    );
    CREATE INDEX playlist_collaborators_user_id_idx ON playlist_collaborators (user_id);

    -- The invite link's secret. Whoever signed in opens the link joins as a collaborator.
    -- Kept in plain text so the owner can copy the same link again; it grants editing one
    -- playlist, nothing about an account. Replacing it stops the old link working.
    ALTER TABLE playlists ADD COLUMN invite_token text UNIQUE;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    ALTER TABLE playlists DROP COLUMN invite_token;
    DROP TABLE playlist_collaborators;
  `);
}
