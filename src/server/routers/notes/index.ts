import { router } from '../../trpc/trpc.ts';
import { create } from './notes.create.ts';
import { deleteNote } from './notes.delete.ts';
import { update } from './notes.update.ts';
import { visible } from './notes.visible.ts';

/** Notes on songs, an author's own or a playlist's (D135). */
export const notesRouter = router({ visible, create, update, delete: deleteNote });
