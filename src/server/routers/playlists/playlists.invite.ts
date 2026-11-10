import { z } from 'zod';
import { idSchema } from '#shared/validators/index.ts';
import { newInviteToken } from '../../playlists/invite.ts';
import { assertOwner } from '../../playlists/load.ts';
import { verifiedProcedure } from '../../trpc/trpc.ts';

/**
 * The owner's invite token, made on first ask. The same link until it is replaced. A mutation, as
 * it may write the token: never a GET, which gets refetched and sent along more freely.
 */
export const invite = verifiedProcedure
  .input(z.object({ id: idSchema }))
  .mutation(async ({ ctx, input }) => {
    await assertOwner(ctx.db, input.id, ctx.user);
    const { rows } = await ctx.db.raw(
      /* sql */ `
        UPDATE playlists SET invite_token = coalesce(invite_token, :token)
        WHERE id = :id
        RETURNING invite_token
      `,
      { id: input.id, token: newInviteToken() },
    );
    return { token: rows[0].invite_token as string };
  });

/** A new link; the old one stops working. People who joined stay. */
export const resetInvite = verifiedProcedure
  .input(z.object({ id: idSchema }))
  .mutation(async ({ ctx, input }) => {
    await assertOwner(ctx.db, input.id, ctx.user);
    const token = newInviteToken();
    await ctx.db.raw(
      /* sql */ `UPDATE playlists SET invite_token = :token WHERE id = :id`,
      {
        id: input.id,
        token,
      },
    );
    return { token };
  });
