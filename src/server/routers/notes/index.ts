import { router } from '../../trpc/trpc.ts';
import { create } from './notes.create.ts';
import { deleteNote } from './notes.delete.ts';
import { resolve } from './notes.resolve.ts';
import { update } from './notes.update.ts';
import { visible } from './notes.visible.ts';

/** Notes on songs: an author's own, a playlist's (D135), or a report for the editors (D143). */
export const notesRouter = router({
  visible,
  create,
  update,
  delete: deleteNote,
  resolve,
});
