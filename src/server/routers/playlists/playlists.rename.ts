import { z } from 'zod';
import { idSchema, playlistNameSchema } from '#shared/validators/index.ts';
import { assertMember, loadVisiblePlaylist } from '../../playlists/load.ts';
import { verifiedProcedure } from '../../trpc/trpc.ts';

/** Owner or collaborator: the name is often the gig, and anyone in the band may fix it. */
export const rename = verifiedProcedure
  .input(z.object({ id: idSchema, name: playlistNameSchema }))
  .mutation(async ({ ctx, input }) => {
    await assertMember(ctx.db, input.id, ctx.user);
    await ctx.db.raw(
      /* sql */ `UPDATE playlists SET name = :name, updated_at = now() WHERE id = :id`,
      input,
    );
    return loadVisiblePlaylist(ctx.db, input.id, ctx.user);
  });
