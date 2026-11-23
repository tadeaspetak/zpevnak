import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    -- Someone in a playlist either edits it with the owner, or only reads it. Everyone who
    -- joined so far joined to edit.
    ALTER TABLE playlist_collaborators
      ADD COLUMN role text NOT NULL DEFAULT 'collaborator'
        CHECK (role IN ('collaborator', 'viewer'));
    -- A removal remembers the role, so undoing it puts the person back as they were.
    ALTER TABLE playlist_collaborator_removals
      ADD COLUMN role text NOT NULL DEFAULT 'collaborator'
        CHECK (role IN ('collaborator', 'viewer'));

    -- The second invite link's secret: whoever joins by it only reads. invite_token stays the
    -- link to edit, so links already sent keep doing what they did.
    ALTER TABLE playlists ADD COLUMN view_token text UNIQUE;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    ALTER TABLE playlists DROP COLUMN view_token;
    ALTER TABLE playlist_collaborator_removals DROP COLUMN role;
    -- Readers had no place before: down, they would be editors. They leave instead.
    DELETE FROM playlist_collaborators WHERE role = 'viewer';
    ALTER TABLE playlist_collaborators DROP COLUMN role;
  `);
}
