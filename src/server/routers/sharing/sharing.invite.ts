import { z } from 'zod';
import { idSchema, joinRoleSchema, sharedKindSchema } from '#shared/validators/index.ts';
import { assertCanInvite } from '../../sharing/access.ts';
import { newInviteToken } from '../../sharing/invite.ts';
import { INVITE_COLUMN, SHARED_TABLES } from '../../sharing/tables.ts';
import { verifiedProcedure } from '../../trpc/trpc.ts';

const input = z.object({ kind: sharedKindSchema, id: idSchema, role: joinRoleSchema });

/**
 * The owner's invite link for a role (to edit, or only to read), made on first ask. The same link
 * until it is replaced. A mutation, as it may write the token: never a GET, which gets refetched
 * and sent along more freely.
 */
export const invite = verifiedProcedure.input(input).mutation(async ({ ctx, input }) => {
  await assertCanInvite(ctx.db, input.kind, input.id, ctx.user);
  const column = INVITE_COLUMN[input.role];
  const { rows } = await ctx.db.raw(
    /* sql */ `
      UPDATE ${SHARED_TABLES[input.kind].things} SET ${column} = coalesce(${column}, :token)
      WHERE id = :id
      RETURNING ${column} AS token
    `,
    { id: input.id, token: newInviteToken() },
  );
  return { token: rows[0].token as string };
});

/** A new link for the role; the old one stops working. People who joined stay. */
export const resetInvite = verifiedProcedure
  .input(input)
  .mutation(async ({ ctx, input }) => {
    await assertCanInvite(ctx.db, input.kind, input.id, ctx.user);
    const token = newInviteToken();
    await ctx.db.raw(
      /* sql */ `
        UPDATE ${SHARED_TABLES[input.kind].things} SET ${INVITE_COLUMN[input.role]} = :token
        WHERE id = :id
      `,
      { id: input.id, token },
    );
    return { token };
  });
