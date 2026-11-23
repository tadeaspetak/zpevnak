import { z } from 'zod';
import { songSourceSchema } from '#shared/validators/index.ts';
import { readHeader } from '../../songs/header.ts';
import { loadSong } from '../../songs/load.ts';
import { recordVersion } from '../../songs/versions.ts';
import { verifiedProcedure } from '../../trpc/trpc.ts';

/**
 * Every new public song starts pending, an editor's too: verifying is its own, deliberate step.
 * A private one is the author's own, outside review (D127).
 */
export const create = verifiedProcedure
  .input(z.object({ source: songSourceSchema, isPrivate: z.boolean().default(false) }))
  .mutation(async ({ ctx, input }) => {
    const { title, artist } = readHeader(input.source);
    const id: number = await ctx.db.transaction(async (trx) => {
      const { rows } = await trx.raw(
        /* sql */ `
          INSERT INTO songs (title, artist, source, created_by, status)
          VALUES (:title, :artist, :source, :userId, :status)
          RETURNING id
        `,
        {
          title,
          artist,
          source: input.source,
          userId: ctx.user.id,
          status: input.isPrivate ? 'private' : 'pending',
        },
      );
      await recordVersion(trx, rows[0].id, 'create', ctx.user.id);
      return rows[0].id;
    });
    return loadSong(ctx.db, id, ctx.user);
  });
