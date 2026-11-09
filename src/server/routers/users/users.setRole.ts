import { z } from 'zod';
import { idSchema, roleSchema } from '#shared/validators/index.ts';
import { adminProcedure, fail } from '../../trpc/trpc.ts';

/** An admin can't change their own role, so the last admin can't lock everyone out. */
export const setRole = adminProcedure
  .input(z.object({ userId: idSchema, role: roleSchema }))
  .mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user.id) {
      fail('BAD_REQUEST', 'CANNOT_CHANGE_OWN_ROLE');
    }
    const { rowCount } = await ctx.db.raw(
      /* sql */ `UPDATE users SET role = :role WHERE id = :userId`,
      input,
    );
    if (rowCount === 0) {
      fail('NOT_FOUND', 'NOT_FOUND');
    }
    return { ok: true };
  });
