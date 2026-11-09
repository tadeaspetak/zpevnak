import { z } from 'zod';
import { idSchema, playlistNameSchema } from '#shared/validators/index.ts';
import { assertOwnPlaylist, loadVisiblePlaylist } from '../../playlists/load.ts';
import { writeSongs } from '../../playlists/writeSongs.ts';
import { verifiedProcedure } from '../../trpc/trpc.ts';

/** Renames, changes visibility, or replaces the song order; whichever fields are given. */
export const update = verifiedProcedure
  .input(
    z.object({
      id: idSchema,
      name: playlistNameSchema.optional(),
      isPublic: z.boolean().optional(),
      songIds: z.array(idSchema).max(500).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await assertOwnPlaylist(ctx.db, input.id, ctx.user);
    await ctx.db.transaction(async (trx) => {
      await trx.raw(
        /* sql */ `
          UPDATE playlists
          SET name = coalesce(:name, name),
              is_public = coalesce(:isPublic, is_public),
              updated_at = now()
          WHERE id = :id
        `,
        { id: input.id, name: input.name ?? null, isPublic: input.isPublic ?? null },
      );
      if (input.songIds) {
        await writeSongs(trx, input.id, input.songIds, ctx.user);
      }
    });
    return loadVisiblePlaylist(ctx.db, input.id, ctx.user);
  });
