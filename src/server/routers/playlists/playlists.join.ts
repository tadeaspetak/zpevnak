import { z } from 'zod';
import { loadVisiblePlaylist } from '../../playlists/load.ts';
import { authedProcedure, fail } from '../../trpc/trpc.ts';

/**
 * Joins the playlist an invite link points to. Joining twice, or as the owner, is fine. Needs
 * an account, not a confirmed one: someone who just signed up from the link lands in the
 * playlist at once, and may edit once their email is confirmed.
 */
export const join = authedProcedure
  .input(z.object({ token: z.string().min(16).max(64) }))
  .mutation(async ({ ctx, input }) => {
    const { rows } = await ctx.db.raw(
      /* sql */ `SELECT id, owner_id FROM playlists WHERE invite_token = :token`,
      { token: input.token },
    );
    const playlist = rows[0];
    if (!playlist) {
      fail('BAD_REQUEST', 'INVALID_TOKEN');
    }
    if (playlist.owner_id !== ctx.user.id) {
      await ctx.db.raw(
        /* sql */ `
          INSERT INTO playlist_collaborators (playlist_id, user_id)
          VALUES (:playlistId, :userId)
          ON CONFLICT DO NOTHING
        `,
        { playlistId: playlist.id, userId: ctx.user.id },
      );
    }
    return loadVisiblePlaylist(ctx.db, playlist.id, ctx.user);
  });
