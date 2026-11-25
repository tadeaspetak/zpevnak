import type { Knex } from 'knex';
import type { SessionUser } from '../auth/sessions.ts';
import { assertCanEdit, PLAYLIST_VISIBLE } from '../playlists/load.ts';
import { SONG_READABLE } from '../songs/record.ts';
import { fail } from '../trpc/trpc.ts';

type NoteRow = {
  id: number;
  song_id: number;
  playlist_id: number | null;
  author_id: number;
  author_name: string;
  text: string;
  todo: boolean;
  done_at: Date | null;
  line_index: number | null;
  line_text: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * Notes the viewer may see (D135), on songs they may read (a private song's notes go with it):
 * their own, and the notes of every playlist they may open (a public one's visitors too) on a
 * song still in it. A song taken out of a playlist keeps its notes there, out of sight, until
 * it comes back. Binds `:viewerId`.
 */
const NOTE_SELECT = /* sql */ `
  SELECT n.id, n.song_id, n.playlist_id, n.author_id, a.display_name AS author_name, n.text,
         n.todo, n.done_at, n.line_index, n.line_text, n.created_at, n.updated_at
  FROM song_notes n
  JOIN users a ON a.id = n.author_id
  JOIN songs s ON s.id = n.song_id
  WHERE ${SONG_READABLE} AND (
    (n.playlist_id IS NULL AND n.author_id = :viewerId)
    OR EXISTS (
      SELECT 1 FROM playlists p
      JOIN playlist_songs ps ON ps.playlist_id = p.id AND ps.song_id = n.song_id
      WHERE p.id = n.playlist_id AND ${PLAYLIST_VISIBLE}
    )
  )
`;

/** A note as the client gets it. An allow-list: never spread a row here. */
function toNoteRecord(row: NoteRow) {
  return {
    id: Number(row.id),
    songId: Number(row.song_id),
    /** The playlist it's for; null: its author's own. */
    playlistId: row.playlist_id === null ? null : Number(row.playlist_id),
    authorId: Number(row.author_id),
    authorName: row.author_name,
    text: row.text,
    todo: row.todo,
    doneAt: row.done_at?.toISOString() ?? null,
    /** Where it is: the line's place among the song's lines and its words; null: the song. */
    line:
      row.line_index === null || row.line_text === null
        ? null
        : { index: row.line_index, text: row.line_text },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Every note the viewer may see, the newest first. */
export async function loadVisibleNotes(db: Knex, viewer: SessionUser | null) {
  const { rows } = await db.raw<{ rows: NoteRow[] }>(
    /* sql */ `${NOTE_SELECT} ORDER BY n.created_at DESC, n.id DESC`,
    { viewerId: viewer?.id ?? null },
  );
  return rows.map(toNoteRecord);
}

/** The note, if the viewer may see it; else NOT_FOUND, whatever it is (hide existence). */
export async function loadNote(db: Knex, id: number, viewer: SessionUser | null) {
  const { rows } = await db.raw<{ rows: NoteRow[] }>(
    /* sql */ `${NOTE_SELECT} AND n.id = :id`,
    { id, viewerId: viewer?.id ?? null },
  );
  const row = rows[0];
  if (!row) {
    fail('NOT_FOUND', 'NOT_FOUND');
  }
  return toNoteRecord(row);
}

/**
 * Who may change or delete a note (D135): one's own, its author (nobody else even sees it); a
 * playlist's, whoever may edit that playlist (shared work, as its songs are), so a reader who
 * sees it gets FORBIDDEN.
 */
export async function assertCanChangeNote(db: Knex, id: number, viewer: SessionUser) {
  const note = await loadNote(db, id, viewer);
  if (note.playlistId !== null) {
    await assertCanEdit(db, note.playlistId, viewer);
  }
  return note;
}
