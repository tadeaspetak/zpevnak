import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    CREATE TYPE user_role AS ENUM ('user', 'editor', 'admin');
    CREATE TYPE locale AS ENUM ('cs', 'en');

    CREATE TABLE users (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      email text NOT NULL,
      display_name text NOT NULL,
      password_hash text NOT NULL,
      role user_role NOT NULL DEFAULT 'user',
      locale locale NOT NULL DEFAULT 'cs',
      email_verified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX users_email_key ON users (lower(email));

    -- Session and email tokens are stored as SHA-256 hashes: a leaked table logs nobody in.
    CREATE TABLE sessions (
      token_hash text PRIMARY KEY,
      user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    );
    CREATE INDEX sessions_user_id_idx ON sessions (user_id);

    CREATE TYPE auth_token_purpose AS ENUM ('verify_email', 'reset_password');
    CREATE TABLE auth_tokens (
      token_hash text PRIMARY KEY,
      user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      purpose auth_token_purpose NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    );
    CREATE INDEX auth_tokens_user_id_idx ON auth_tokens (user_id);

    CREATE TYPE song_status AS ENUM ('pending', 'verified', 'rejected');
    CREATE TYPE rejection_reason AS ENUM ('too_many_mistakes', 'totally_wrong', 'duplicate', 'other');

    -- source is the ChordPro text and the only truth about a song. title and artist are
    -- read from it on every save, so a song can never disagree with its own header.
    CREATE TABLE songs (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title text NOT NULL,
      artist text,
      source text NOT NULL,
      status song_status NOT NULL DEFAULT 'pending',
      rejection_reason rejection_reason,
      rejection_note text,
      created_by bigint REFERENCES users (id) ON DELETE SET NULL,
      reviewed_by bigint REFERENCES users (id) ON DELETE SET NULL,
      reviewed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT songs_rejection_has_reason
        CHECK ((status = 'rejected') = (rejection_reason IS NOT NULL))
    );
    -- Devices sync by "what changed since".
    CREATE INDEX songs_updated_at_idx ON songs (updated_at);
    CREATE INDEX songs_status_created_at_idx ON songs (status, created_at);

    CREATE TABLE playlists (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      owner_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      name text NOT NULL,
      is_public boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX playlists_owner_id_idx ON playlists (owner_id);

    CREATE TABLE playlist_songs (
      playlist_id bigint NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
      position integer NOT NULL,
      song_id bigint NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
      PRIMARY KEY (playlist_id, position)
    );
    CREATE INDEX playlist_songs_song_id_idx ON playlist_songs (song_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    DROP TABLE playlist_songs;
    DROP TABLE playlists;
    DROP TABLE songs;
    DROP TYPE rejection_reason;
    DROP TYPE song_status;
    DROP TABLE auth_tokens;
    DROP TYPE auth_token_purpose;
    DROP TABLE sessions;
    DROP TABLE users;
    DROP TYPE locale;
    DROP TYPE user_role;
  `);
}
