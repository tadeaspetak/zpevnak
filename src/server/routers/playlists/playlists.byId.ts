import { z } from 'zod';
import { idSchema } from '#shared/validators/index.ts';
import { loadVisiblePlaylist } from '../../playlists/load.ts';
import { publicProcedure } from '../../trpc/trpc.ts';

export const byId = publicProcedure
  .input(z.object({ id: idSchema }))
  .query(({ ctx, input }) => loadVisiblePlaylist(ctx.db, input.id, ctx.user));
