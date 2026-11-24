import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    -- The key a playlist plays a song in, when not the song's own: its starting point for
    -- everyone who plays the playlist. Per song, not per place, so a song twice in a list is
    -- in one key; kept apart from playlist_songs, which is rewritten on every edit. As a
    -- device keeps a transposition: semitones from the pitch the song started from then, so a
    -- key later saved for everyone moves it right.
    CREATE TABLE playlist_song_keys (
      playlist_id bigint NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
      song_id bigint NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
      semitones smallint NOT NULL CHECK (semitones BETWEEN -11 AND 11 AND semitones <> 0),
      from_pitch smallint CHECK (from_pitch BETWEEN 0 AND 11),
      PRIMARY KEY (playlist_id, song_id)
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `DROP TABLE playlist_song_keys;`);
}
