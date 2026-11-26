import { parseSong } from '#shared/chordpro/parse.ts';
import { notePlaces, placeOf } from '#shared/notes.ts';
import { editsAsMember } from '#shared/roles.ts';
import type { LocalNote } from './catalog.ts';
import type { NoteRecord, PlaylistRecord, SongRecord } from './store.ts';

/** How one's notes are filtered (D135): all, the TODOs still to do, or those done. */
export type NoteFilter = 'all' | 'todo' | 'done';

/**
 * The notes `authorId` wrote, newest first: those on a song the device has, which are the ones
 * that can be shown and followed to their song. The account page counts the same ones.
 */
export function notesBy(
  notes: Map<number, LocalNote>,
  songs: Map<number, SongRecord>,
  authorId: number | undefined,
): LocalNote[] {
  return [...notes.values()]
    .filter((n) => n.authorId === authorId && songs.has(n.songId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}

/**
 * Whether the viewer may change or delete a note they see (D135): their own, always (once the
 * server has it); a playlist's, while they may edit that playlist (`playlist`: the one it's
 * for, if the device has it); a report, its author (D143), whom the editors who see it don't
 * replace. As the server decides it (`assertCanChangeNote`), so nobody is offered what would
 * be refused. A report resolved can still be deleted, not rewritten (`isResolved`).
 */
export function canChangeNote(
  note: LocalNote,
  playlist: Pick<PlaylistRecord, 'id' | 'role'> | null | undefined,
  viewer: { id: number; emailVerified: boolean } | null,
): boolean {
  // Waiting for the connection, it isn't the server's yet: nothing to change.
  if (!viewer?.emailVerified || note.waiting) {
    return false;
  }
  switch (note.kind) {
    case 'own':
      return true;
    case 'playlist':
      return playlist?.id === note.playlistId && editsAsMember(playlist.role);
    case 'report':
      return note.authorId === viewer.id;
  }
}

/**
 * The reports waiting for an editor (D143), the oldest first: the queue's "Hlášení" and its
 * count (D144). An editor's device has every one (`notes.visible`), so it counts them itself:
 * the server's, on songs the device has, so the count and the list agree.
 */
export function openReports(
  notes: Map<number, LocalNote>,
  songs: Map<number, SongRecord>,
): LocalNote[] {
  return [...notes.values()]
    .filter(
      (n) => n.kind === 'report' && !isResolved(n) && !n.waiting && songs.has(n.songId),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
}

/** A report of a mistake that has been fixed (D143): off the song, kept by its author. */
export function isResolved(note: NoteRecord): boolean {
  return note.resolvedAt !== null;
}

export function inFilter(note: NoteRecord, filter: NoteFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'todo':
      return note.todo && note.doneAt === null;
    case 'done':
      return note.todo && note.doneAt !== null;
  }
}

/**
 * Where a report's line is in the text being edited (D148): found again by its place and words
 * (`placeOf`), as a note is; the source line it starts on. Null for one on the whole song, or
 * whose line is gone.
 */
export function reportLine(source: string, report: NoteRecord): number | null {
  if (!report.line) {
    return null;
  }
  const places = notePlaces(parseSong(source));
  const place = placeOf(places, report.line);
  return places.flat().find((p) => p !== null && p.place === place)?.before ?? null;
}
