import { z } from 'zod';
import { songSourceSchema } from '#shared/validators/index.ts';
import { readHeader } from '../../songs/header.ts';
import { loadSong } from '../../songs/load.ts';
import { recordVersion } from '../../songs/versions.ts';
import { verifiedProcedure } from '../../trpc/trpc.ts';

/** Every new song starts pending, an editor's too: verifying is its own, deliberate step. */
export const create = verifiedProcedure
  .input(z.object({ source: songSourceSchema }))
  .mutation(async ({ ctx, input }) => {
    const { title, artist } = readHeader(input.source);
    const id: number = await ctx.db.transaction(async (trx) => {
      const { rows } = await trx.raw(
        /* sql */ `
          INSERT INTO songs (title, artist, source, created_by)
          VALUES (:title, :artist, :source, :userId)
          RETURNING id
        `,
        { title, artist, source: input.source, userId: ctx.user.id },
      );
      await recordVersion(trx, rows[0].id, 'create', ctx.user.id);
      return rows[0].id;
    });
    return loadSong(ctx.db, id, ctx.user);
  });
