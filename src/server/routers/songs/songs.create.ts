import { z } from 'zod';
import { songSourceSchema } from '#shared/validators/index.ts';
import { readHeader } from '../../songs/header.ts';
import { loadVisibleSong } from '../../songs/load.ts';
import { verifiedProcedure } from '../../trpc/trpc.ts';

/** Every new song starts pending, an editor's too: verifying is its own, deliberate step. */
export const create = verifiedProcedure
  .input(z.object({ source: songSourceSchema }))
  .mutation(async ({ ctx, input }) => {
    const { title, artist } = readHeader(input.source);
    const { rows } = await ctx.db.raw(
      /* sql */ `
        INSERT INTO songs (title, artist, source, created_by)
        VALUES (:title, :artist, :source, :userId)
        RETURNING id
      `,
      { title, artist, source: input.source, userId: ctx.user.id },
    );
    return loadVisibleSong(ctx.db, rows[0].id, ctx.user);
  });
