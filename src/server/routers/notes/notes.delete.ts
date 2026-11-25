import { z } from 'zod';
import { idSchema } from '#shared/validators/index.ts';
import { assertCanChangeNote } from '../../notes/record.ts';
import { verifiedProcedure } from '../../trpc/trpc.ts';

/** Deletes a note, by whoever may change it (D135). */
export const deleteNote = verifiedProcedure
  .input(z.object({ id: idSchema }))
  .mutation(async ({ ctx, input }) => {
    await assertCanChangeNote(ctx.db, input.id, ctx.user);
    await ctx.db.raw(/* sql */ `DELETE FROM song_notes WHERE id = :id`, input);
    return { ok: true };
  });
