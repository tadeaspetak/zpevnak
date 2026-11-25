import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    -- Notes on songs, never in their text (the text is everyone's): an author's own, or a
    -- playlist's (playlist_id), for whoever sees that playlist. At a line, kept by its place
    -- among the song's lines and its words, so it can be found again after an edit; or on the
    -- whole song (no line). A TODO is an author's own, and stays, marked done, once done.
    CREATE TABLE song_notes (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      song_id bigint NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
      author_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      playlist_id bigint REFERENCES playlists (id) ON DELETE CASCADE,
      text text NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
      todo boolean NOT NULL DEFAULT false,
      done_at timestamptz,
      line_index integer CHECK (line_index >= 0),
      line_text text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT song_notes_todo_is_private CHECK (NOT todo OR playlist_id IS NULL),
      CONSTRAINT song_notes_done_is_a_todo CHECK (done_at IS NULL OR todo),
      CONSTRAINT song_notes_line_whole CHECK ((line_index IS NULL) = (line_text IS NULL))
    );
    CREATE INDEX song_notes_author_idx ON song_notes (author_id) WHERE playlist_id IS NULL;
    CREATE INDEX song_notes_playlist_idx ON song_notes (playlist_id, song_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `DROP TABLE song_notes;`);
}
