import { z } from 'zod';
import { idSchema } from '#shared/validators/index.ts';
import { assertOwner, loadVisiblePlaylist } from '../../playlists/load.ts';
import { verifiedProcedure } from '../../trpc/trpc.ts';

export const setPublic = verifiedProcedure
  .input(z.object({ id: idSchema, isPublic: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    await assertOwner(ctx.db, input.id, ctx.user);
    await ctx.db.raw(
      /* sql */ `UPDATE playlists SET is_public = :isPublic, updated_at = now() WHERE id = :id`,
      input,
    );
    return loadVisiblePlaylist(ctx.db, input.id, ctx.user);
  });
