import { loadVisiblePlaylists } from '../../playlists/load.ts';
import { publicProcedure } from '../../trpc/trpc.ts';

/** All playlists the viewer can open. Small enough to keep whole on every device. */
export const all = publicProcedure.query(({ ctx }) =>
  loadVisiblePlaylists(ctx.db, ctx.user),
);
