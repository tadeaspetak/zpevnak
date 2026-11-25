import { z } from 'zod';
import { idSchema, noteTextSchema } from '#shared/validators/index.ts';
import { assertCanChangeNote, loadNote } from '../../notes/record.ts';
import { fail, verifiedProcedure } from '../../trpc/trpc.ts';

/**
 * Rewrites a note, makes it a TODO or not, marks a TODO done or not (D135). By whoever may
 * change it (`assertCanChangeNote`). A playlist's note can't be a TODO; a done TODO stays,
 * marked, until deleted.
 */
export const update = verifiedProcedure
  .input(
    z.object({
      id: idSchema,
      text: noteTextSchema,
      todo: z.boolean(),
      done: z.boolean(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const note = await assertCanChangeNote(ctx.db, input.id, ctx.user);
    if (input.todo && note.playlistId !== null) {
      fail('BAD_REQUEST', 'NOTE_TODO_PRIVATE');
    }
    await ctx.db.raw(
      /* sql */ `
        UPDATE song_notes
        SET text = :text, todo = :todo, updated_at = now(),
            -- Done when it became done, kept while it stays so.
            done_at = CASE WHEN :todo AND :done THEN coalesce(done_at, now()) END
        WHERE id = :id
      `,
      input,
    );
    return loadNote(ctx.db, input.id, ctx.user);
  });
