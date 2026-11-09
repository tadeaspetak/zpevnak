import { z } from 'zod';
import { fail, publicProcedure } from '../../trpc/trpc.ts';

/**
 * What an invite link leads to, for the join page to name before its reader has an account.
 * The link is the permission: whoever holds it may see the playlist's name and owner.
 */
export const invitePreview = publicProcedure
  .input(z.object({ token: z.string().min(16).max(64) }))
  .query(async ({ ctx, input }) => {
    const { rows } = await ctx.db.raw(
      /* sql */ `
        SELECT p.name, u.display_name AS owner_name
        FROM playlists p JOIN users u ON u.id = p.owner_id
        WHERE p.invite_token = :token
      `,
      { token: input.token },
    );
    const row = rows[0];
    if (!row) {
      fail('NOT_FOUND', 'INVALID_TOKEN');
    }
    return { name: row.name as string, ownerName: row.owner_name as string };
  });
