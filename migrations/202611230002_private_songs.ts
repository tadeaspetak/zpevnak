import type { Knex } from 'knex';

// Outside the batch's shared transaction: an enum value added in a transaction can't be used
// until it commits, and the next migration (an index on status = 'private') uses it. Each
// statement list below still runs as one unit.
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    -- A private song is outside the songbook: never reviewed, seen only by its owner and the
    -- people it is shared with. A status rather than a flag, so it can't also be approved.
    ALTER TYPE song_status ADD VALUE 'private';

    -- Who a private song is shared with, as for playlists (playlist_collaborators).
    CREATE TABLE song_members (
      song_id bigint NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
      user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('collaborator', 'viewer')),
      joined_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (song_id, user_id)
    );
    CREATE INDEX song_members_user_id_idx ON song_members (user_id);

    -- Removals kept a few minutes, to be undone (as playlist_collaborator_removals).
    CREATE TABLE song_member_removals (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      song_id bigint NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
      user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('collaborator', 'viewer')),
      joined_at timestamptz NOT NULL,
      removed_at timestamptz NOT NULL DEFAULT now(),
      restored_at timestamptz
    );
    CREATE INDEX song_member_removals_song_user_idx
      ON song_member_removals (song_id, user_id, removed_at);

    -- The two invite links' secrets, as for playlists.
    ALTER TABLE songs ADD COLUMN invite_token text UNIQUE;
    ALTER TABLE songs ADD COLUMN view_token text UNIQUE;

    -- A public song that went private: every device that has it drops it on its next sync,
    -- as song_deletions does for a deleted one.
    CREATE TABLE song_withdrawals (
      song_id bigint PRIMARY KEY REFERENCES songs (id) ON DELETE CASCADE,
      withdrawn_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    -- Private songs have nowhere to go: made public they would be published to everyone. They
    -- go, as the people they were shared with do (as readers did in 202611230001).
    DELETE FROM songs WHERE status = 'private';

    DROP TABLE song_withdrawals;
    ALTER TABLE songs DROP COLUMN view_token;
    ALTER TABLE songs DROP COLUMN invite_token;
    DROP TABLE song_member_removals;
    DROP TABLE song_members;

    -- An enum loses a value only by being made again. The check names a status of the old
    -- type, so it comes off while the column changes.
    ALTER TABLE songs DROP CONSTRAINT songs_rejection_has_reason;
    ALTER TABLE songs ALTER COLUMN status DROP DEFAULT;
    ALTER TYPE song_status RENAME TO song_status_with_private;
    CREATE TYPE song_status AS ENUM ('pending', 'verified', 'rejected');
    ALTER TABLE songs ALTER COLUMN status TYPE song_status USING status::text::song_status;
    ALTER TABLE songs ALTER COLUMN status SET DEFAULT 'pending';
    DROP TYPE song_status_with_private;
    ALTER TABLE songs ADD CONSTRAINT songs_rejection_has_reason
      CHECK ((status = 'rejected') = (rejection_reason IS NOT NULL));
  `);
}
