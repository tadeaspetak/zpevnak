import { z } from 'zod';
import { inviteTokenSchema } from '#shared/validators/index.ts';
import { loadShared } from '../../sharing/access.ts';
import { findInvite } from '../../sharing/invite.ts';
import { SHARED_TABLES } from '../../sharing/tables.ts';
import { authedProcedure, fail } from '../../trpc/trpc.ts';

/**
 * Joins what an invite link points to, in the role the link gives. Joining twice, or as the
 * owner, is fine; a link to edit makes a reader a collaborator, a link to read never takes
 * editing away. Needs an account, not a confirmed one: someone who just signed up from the link
 * lands in it at once, and may edit once their email is confirmed.
 */
export const join = authedProcedure
  .input(z.object({ token: inviteTokenSchema }))
  .mutation(async ({ ctx, input }) => {
    const invite = await findInvite(ctx.db, input.token);
    if (!invite) {
      fail('BAD_REQUEST', 'INVALID_TOKEN');
    }
    if (invite.ownerId !== ctx.user.id) {
      const { members, key } = SHARED_TABLES[invite.kind];
      await ctx.db.raw(
        /* sql */ `
          INSERT INTO ${members} (${key}, user_id, role)
          VALUES (:id, :userId, :role)
          ON CONFLICT (${key}, user_id) DO UPDATE SET role = 'collaborator'
            WHERE excluded.role = 'collaborator'
        `,
        { id: invite.id, userId: ctx.user.id, role: invite.role },
      );
    }
    return loadShared(ctx.db, invite.kind, invite.id, ctx.user);
  });
