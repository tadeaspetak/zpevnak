import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    -- What a note is, said rather than read from playlist_id: its author's own, a playlist's,
    -- or a report of a mistake in the song, for the songbook's editors and the song's author
    -- (a TODO for any editor, resolved once fixed). The notes so far are own or a playlist's.
    ALTER TABLE song_notes ADD COLUMN kind text;
    UPDATE song_notes SET kind = CASE WHEN playlist_id IS NULL THEN 'own' ELSE 'playlist' END;
    ALTER TABLE song_notes
      ALTER COLUMN kind SET NOT NULL,
      ADD CONSTRAINT song_notes_kind CHECK (kind IN ('own', 'playlist', 'report')),
      ADD CONSTRAINT song_notes_playlist_kind CHECK ((kind = 'playlist') = (playlist_id IS NOT NULL)),
      DROP CONSTRAINT song_notes_todo_is_private,
      ADD CONSTRAINT song_notes_todo_is_own CHECK (NOT todo OR kind = 'own'),
      ADD COLUMN resolved_at timestamptz,
      ADD COLUMN resolved_by bigint REFERENCES users (id) ON DELETE SET NULL,
      ADD CONSTRAINT song_notes_resolved_is_a_report CHECK (resolved_at IS NULL OR kind = 'report');
    -- The editors' open reports, the oldest first.
    CREATE INDEX song_notes_open_reports_idx ON song_notes (created_at)
      WHERE kind = 'report' AND resolved_at IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(/* sql */ `
    -- Without a kind, a report would read as its author's own note: they go.
    DELETE FROM song_notes WHERE kind = 'report';
    DROP INDEX song_notes_open_reports_idx;
    ALTER TABLE song_notes
      DROP CONSTRAINT song_notes_resolved_is_a_report,
      DROP COLUMN resolved_by,
      DROP COLUMN resolved_at,
      DROP CONSTRAINT song_notes_todo_is_own,
      ADD CONSTRAINT song_notes_todo_is_private CHECK (NOT todo OR playlist_id IS NULL),
      DROP CONSTRAINT song_notes_playlist_kind,
      DROP CONSTRAINT song_notes_kind,
      DROP COLUMN kind;
  `);
}
