import { z } from 'zod';
import { inviteTokenSchema } from '#shared/validators/index.ts';
import { findInvite } from '../../playlists/invite.ts';
import { loadVisiblePlaylist } from '../../playlists/load.ts';
import { authedProcedure, fail } from '../../trpc/trpc.ts';

/**
 * Joins the playlist an invite link points to, in the role the link gives. Joining twice, or as
 * the owner, is fine; a link to edit makes a reader a collaborator, a link to read never takes
 * editing away. Needs an account, not a confirmed one: someone who just signed up from the link
 * lands in the playlist at once, and may edit once their email is confirmed.
 */
export const join = authedProcedure
  .input(z.object({ token: inviteTokenSchema }))
  .mutation(async ({ ctx, input }) => {
    const invite = await findInvite(ctx.db, input.token);
    if (!invite) {
      fail('BAD_REQUEST', 'INVALID_TOKEN');
    }
    if (invite.ownerId !== ctx.user.id) {
      await ctx.db.raw(
        /* sql */ `
          INSERT INTO playlist_collaborators (playlist_id, user_id, role)
          VALUES (:playlistId, :userId, :role)
          ON CONFLICT (playlist_id, user_id) DO UPDATE SET role = 'collaborator'
            WHERE excluded.role = 'collaborator'
        `,
        { playlistId: invite.playlistId, userId: ctx.user.id, role: invite.role },
      );
    }
    return loadVisiblePlaylist(ctx.db, invite.playlistId, ctx.user);
  });
