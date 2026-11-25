import type { NoteRecord } from './store.ts';

/** How one's notes are filtered (D135): all, the TODOs still to do, or those done. */
export type NoteFilter = 'all' | 'todo' | 'done';

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
