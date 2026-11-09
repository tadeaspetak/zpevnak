import { z } from 'zod';
import { idSchema } from '#shared/validators/index.ts';
import { loadSong } from '../../songs/load.ts';
import { publicProcedure } from '../../trpc/trpc.ts';

export const byId = publicProcedure
  .input(z.object({ id: idSchema }))
  .query(({ ctx, input }) => loadSong(ctx.db, input.id, ctx.user));
