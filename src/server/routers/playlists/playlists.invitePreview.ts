import { z } from 'zod';
import { inviteTokenSchema } from '#shared/validators/index.ts';
import { loadInvitePreview } from '../../playlists/invite.ts';
import { fail, publicProcedure } from '../../trpc/trpc.ts';

/**
 * What an invite link leads to, for the join page to name before its reader has an account.
 * A public playlist, which anyone may see anyway, also gives its id: the page can offer just to
 * look.
 */
export const invitePreview = publicProcedure
  .input(z.object({ token: inviteTokenSchema }))
  .query(async ({ ctx, input }) => {
    const preview = await loadInvitePreview(ctx.db, input.token);
    if (!preview) {
      fail('NOT_FOUND', 'INVALID_TOKEN');
    }
    return preview;
  });
