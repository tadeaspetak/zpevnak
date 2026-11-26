import type { Knex } from 'knex';
import type { SessionUser } from '../auth/sessions.ts';
import { assertCanEdit, PLAYLIST_VISIBLE } from '../playlists/load.ts';
import { SONG_READABLE } from '../songs/record.ts';
import { fail } from '../trpc/trpc.ts';

/**
 * What a note is (D135, D143): its author's own, a playlist's, or a report of a mistake in the
 * song, for the songbook's editors and the song's author.
 */
type NoteKind = 'own' | 'playlist' | 'report';

type NoteRow = {
  id: number;
  song_id: number;
  kind: NoteKind;
  playlist_id: number | null;
  author_id: number;
  author_name: string;
  text: string;
  todo: boolean;
  done_at: Date | null;
  line_index: number | null;
  line_text: string | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * Notes the viewer may see (D135), on songs they may read (a private song's notes go with it):
 * their own, and the notes of every playlist they may open (a public one's visitors too) on a
 * song still in it. A song taken out of a playlist keeps its notes there, out of sight, until
 * it comes back. A report (D143): its author's, always; open, the songbook's editors' and the
 * song's author's too, never a player's. Binds `:viewerId`.
 */
const NOTE_SELECT = /* sql */ `
  SELECT n.id, n.song_id, n.kind, n.playlist_id, n.author_id, a.display_name AS author_name,
         n.text, n.todo, n.done_at, n.line_index, n.line_text, n.resolved_at, n.created_at,
         n.updated_at
  FROM song_notes n
  JOIN users a ON a.id = n.author_id
  JOIN songs s ON s.id = n.song_id
  WHERE ${SONG_READABLE} AND (
    (n.kind IN ('own', 'report') AND n.author_id = :viewerId)
    OR (n.kind = 'playlist' AND EXISTS (
      SELECT 1 FROM playlists p
      JOIN playlist_songs ps ON ps.playlist_id = p.id AND ps.song_id = n.song_id
      WHERE p.id = n.playlist_id AND ${PLAYLIST_VISIBLE}
    ))
    OR (n.kind = 'report' AND n.resolved_at IS NULL AND (
      s.created_by = :viewerId
      OR EXISTS (
        SELECT 1 FROM users v WHERE v.id = :viewerId AND v.role IN ('editor', 'admin')
      )
    ))
  )
`;

/** A note as the client gets it. An allow-list: never spread a row here. */
function toNoteRecord(row: NoteRow) {
  return {
    id: Number(row.id),
    songId: Number(row.song_id),
    kind: row.kind,
    /** The playlist it's for, a playlist's note's; null for any other. */
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
    /** A report fixed (D143); null while open, and for any other note. */
    resolvedAt: row.resolved_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
export type NoteRecord = ReturnType<typeof toNoteRecord>;

/** Every note the viewer may see, the newest first. */
export async function loadVisibleNotes(db: Knex, viewer: SessionUser | null) {
  const { rows } = await db.raw<{ rows: NoteRow[] }>(
    /* sql */ `${NOTE_SELECT} ORDER BY n.created_at DESC, n.id DESC`,
    { viewerId: viewer?.id ?? null },
  );
  return rows.map(toNoteRecord);
}

/** The note, if the viewer may see it; else null. */
export async function findNote(db: Knex, id: number, viewer: SessionUser | null) {
  const { rows } = await db.raw<{ rows: NoteRow[] }>(
    /* sql */ `${NOTE_SELECT} AND n.id = :id`,
    { id, viewerId: viewer?.id ?? null },
  );
  const row = rows[0];
  return row ? toNoteRecord(row) : null;
}

/** The note, if the viewer may see it; else NOT_FOUND, whatever it is (hide existence). */
export async function loadNote(db: Knex, id: number, viewer: SessionUser | null) {
  const note = await findNote(db, id, viewer);
  if (!note) {
    fail('NOT_FOUND', 'NOT_FOUND');
  }
  return note;
}

/**
 * Who may change or delete a note (D135): one's own, its author (nobody else even sees it); a
 * playlist's, whoever may edit that playlist (shared work, as its songs are), so a reader who
 * sees it gets FORBIDDEN; a report, its author (D143): the editors who see it resolve it
 * (`notes.resolve`), they don't rewrite it.
 */
export async function assertCanChangeNote(db: Knex, id: number, viewer: SessionUser) {
  const note = await loadNote(db, id, viewer);
  if (note.kind === 'playlist' && note.playlistId !== null) {
    await assertCanEdit(db, note.playlistId, viewer);
  }
  if (note.kind === 'report' && note.authorId !== viewer.id) {
    fail('FORBIDDEN', 'FORBIDDEN');
  }
  return note;
}
