import { z } from 'zod';
import { idSchema } from '#shared/validators/index.ts';
import { assertOwner } from '../../playlists/load.ts';
import { verifiedProcedure } from '../../trpc/trpc.ts';

export const deletePlaylist = verifiedProcedure
  .input(z.object({ id: idSchema }))
  .mutation(async ({ ctx, input }) => {
    await assertOwner(ctx.db, input.id, ctx.user);
    await ctx.db.raw(/* sql */ `DELETE FROM playlists WHERE id = :id`, { id: input.id });
    return { ok: true };
  });
