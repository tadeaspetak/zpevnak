import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    -- Every save of a song's text, kept for good: who changed what, and a way back (D86).
    -- More kinds come with suggestions and reverts.
    CREATE TYPE song_version_kind AS ENUM ('create', 'edit', 'approve');

    CREATE TABLE song_versions (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      song_id bigint NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
      kind song_version_kind NOT NULL,
      source text NOT NULL,
      title text NOT NULL,
      artist text,
      saved_by bigint REFERENCES users (id) ON DELETE SET NULL,
      saved_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX song_versions_song_id_idx ON song_versions (song_id, id);

    -- Songs saved before history began start it with their current text, as created by their
    -- author when they were added: the edits in between weren't kept.
    INSERT INTO song_versions (song_id, kind, source, title, artist, saved_by, saved_at)
    SELECT id, 'create', source, title, artist, created_by, created_at
    FROM songs
    ORDER BY id;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    DROP TABLE song_versions;
    DROP TYPE song_version_kind;
  `);
}
