import { z } from 'zod';
import { idSchema, playlistNameSchema } from '#shared/validators/index.ts';
import { assertCanEdit, loadVisiblePlaylist } from '../../playlists/load.ts';
import { verifiedProcedure } from '../../trpc/trpc.ts';

/** Owner or collaborator: the name is often the gig, and anyone in the band may fix it. */
export const rename = verifiedProcedure
  .input(z.object({ id: idSchema, name: playlistNameSchema }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db.transaction(async (trx) => {
      await trx.raw(/* sql */ `SELECT 1 FROM playlists WHERE id = :id FOR UPDATE`, {
        id: input.id,
      });
      // Under the lock: someone made a reader meanwhile no longer renames (D104).
      await assertCanEdit(trx, input.id, ctx.user);
      await trx.raw(
        /* sql */ `UPDATE playlists SET name = :name, updated_at = now() WHERE id = :id`,
        input,
      );
    });
    return loadVisiblePlaylist(ctx.db, input.id, ctx.user);
  });
