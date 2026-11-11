import { z } from 'zod';
import { inviteTokenSchema } from '#shared/validators/index.ts';
import { fail, publicProcedure } from '../../trpc/trpc.ts';

/**
 * What an invite link leads to, for the join page to name before its reader has an account.
 * The link is the permission: whoever holds it may see the playlist's name and owner. A public
 * playlist, which anyone may see anyway, also gives its id: the page can offer just to look.
 */
export const invitePreview = publicProcedure
  .input(z.object({ token: inviteTokenSchema }))
  .query(async ({ ctx, input }) => {
    const { rows } = await ctx.db.raw(
      /* sql */ `
        SELECT p.id, p.name, p.is_public, u.display_name AS owner_name
        FROM playlists p JOIN users u ON u.id = p.owner_id
        WHERE p.invite_token = :token
      `,
      { token: input.token },
    );
    const row = rows[0];
    if (!row) {
      fail('NOT_FOUND', 'INVALID_TOKEN');
    }
    return {
      name: row.name as string,
      ownerName: row.owner_name as string,
      publicId: row.is_public ? Number(row.id) : null,
    };
  });
