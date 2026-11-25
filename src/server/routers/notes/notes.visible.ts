import { loadVisibleNotes } from '../../notes/record.ts';
import { publicProcedure } from '../../trpc/trpc.ts';

/**
 * Every note the viewer may see (D135), whole: one's own and one's playlists' are few, and a
 * playlist's are for a public one's visitors too. The device keeps them, as it keeps
 * playlists (`playlists.all`).
 */
export const visible = publicProcedure.query(({ ctx }) =>
  loadVisibleNotes(ctx.db, ctx.user),
);
