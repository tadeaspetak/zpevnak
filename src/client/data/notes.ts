import { editsAsMember } from '#shared/roles.ts';
import type { NoteRecord, PlaylistRecord, SongRecord } from './store.ts';

/** How one's notes are filtered (D135): all, the TODOs still to do, or those done. */
export type NoteFilter = 'all' | 'todo' | 'done';

/**
 * The notes `authorId` wrote, newest first: those on a song the device has, which are the ones
 * that can be shown and followed to their song. The account page counts the same ones.
 */
export function notesBy(
  notes: Map<number, NoteRecord>,
  songs: Map<number, SongRecord>,
  authorId: number | undefined,
): NoteRecord[] {
  return [...notes.values()]
    .filter((n) => n.authorId === authorId && songs.has(n.songId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}

/**
 * Whether the viewer may change a note they see (D135): their own, always; a playlist's, while
 * they may edit that playlist (`playlist`: the one it's for, if the device has it). As the
 * server decides it (`assertCanChangeNote`), so nobody is offered what would be refused.
 */
export function canChangeNote(
  note: NoteRecord,
  playlist: Pick<PlaylistRecord, 'id' | 'role'> | null | undefined,
  verified: boolean,
): boolean {
  if (!verified) {
    return false;
  }
  return (
    note.playlistId === null ||
    (playlist?.id === note.playlistId && editsAsMember(playlist.role))
  );
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
