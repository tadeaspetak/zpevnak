import { z } from 'zod';
import { idSchema } from '#shared/validators/index.ts';
import { loadVisibleSong } from '../../songs/load.ts';
import { publicProcedure } from '../../trpc/trpc.ts';

export const byId = publicProcedure
  .input(z.object({ id: idSchema }))
  .query(({ ctx, input }) => loadVisibleSong(ctx.db, input.id, ctx.user));
