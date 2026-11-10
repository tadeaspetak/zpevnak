import type { Knex } from 'knex';

// Outside the batch's transaction, so the next migration can use the new enum value.
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    -- A rejection is part of a song's history too: what was rejected, why, and by whom. The
    -- song itself forgets its rejection once it is fixed (D81); its versions remember it, so a
    -- fixed song can say it was fixed and the editor can see what was asked for.
    ALTER TYPE song_version_kind ADD VALUE 'reject';

    ALTER TABLE song_versions
      ADD COLUMN rejection_reason rejection_reason,
      ADD COLUMN rejection_note text;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    DELETE FROM song_versions WHERE kind = 'reject';
    ALTER TABLE song_versions DROP COLUMN rejection_reason, DROP COLUMN rejection_note;

    ALTER TYPE song_version_kind RENAME TO song_version_kind_old;
    CREATE TYPE song_version_kind AS ENUM ('create', 'edit', 'approve');
    ALTER TABLE song_versions
      ALTER COLUMN kind TYPE song_version_kind USING kind::text::song_version_kind;
    DROP TYPE song_version_kind_old;
  `);
}
