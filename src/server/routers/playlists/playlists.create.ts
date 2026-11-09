import { z } from 'zod';
import { idSchema, playlistNameSchema } from '#shared/validators/index.ts';
import { loadVisiblePlaylist } from '../../playlists/load.ts';
import { assertSongsUsable, writeSongs } from '../../playlists/writeSongs.ts';
import { verifiedProcedure } from '../../trpc/trpc.ts';

export const create = verifiedProcedure
  .input(
    z.object({
      name: playlistNameSchema,
      isPublic: z.boolean(),
      songIds: z.array(idSchema).max(500).default([]),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const id = await ctx.db.transaction(async (trx) => {
      await assertSongsUsable(trx, input.songIds, ctx.user);
      const { rows } = await trx.raw(
        /* sql */ `
          INSERT INTO playlists (owner_id, name, is_public)
          VALUES (:ownerId, :name, :isPublic)
          RETURNING id
        `,
        { ownerId: ctx.user.id, name: input.name, isPublic: input.isPublic },
      );
      const playlistId: number = rows[0].id;
      await writeSongs(trx, playlistId, input.songIds);
      return playlistId;
    });
    return loadVisiblePlaylist(ctx.db, id, ctx.user);
  });
