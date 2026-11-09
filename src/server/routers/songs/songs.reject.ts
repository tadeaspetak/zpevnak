import { z } from 'zod';
import { idSchema, rejectionReasonSchema } from '#shared/validators/index.ts';
import { loadSongRow, loadSong } from '../../songs/load.ts';
import { editorProcedure } from '../../trpc/trpc.ts';

export const reject = editorProcedure
  .input(
    z.object({
      id: idSchema,
      reason: rejectionReasonSchema,
      note: z.string().trim().max(1000).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await loadSongRow(ctx.db, input.id);
    await ctx.db.raw(
      /* sql */ `
        UPDATE songs
        SET status = 'rejected', rejection_reason = :reason, rejection_note = :note,
            reviewed_by = :userId, reviewed_at = now(), updated_at = now()
        WHERE id = :id
      `,
      {
        id: input.id,
        reason: input.reason,
        note: input.note || null,
        userId: ctx.user.id,
      },
    );
    return loadSong(ctx.db, input.id, ctx.user);
  });
