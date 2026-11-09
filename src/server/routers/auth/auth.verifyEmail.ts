import { z } from 'zod';
import { tokenSchema } from '#shared/validators/index.ts';
import { consumeEmailToken } from '../../auth/emailTokens.ts';
import { fail, publicProcedure } from '../../trpc/trpc.ts';

export const verifyEmailProcedure = publicProcedure
  .input(z.object({ token: tokenSchema }))
  .mutation(async ({ ctx, input }) => {
    const userId = await consumeEmailToken(ctx.db, input.token, 'verify_email');
    if (userId === null) {
      fail('BAD_REQUEST', 'INVALID_TOKEN');
    }
    await ctx.db.raw(
      /* sql */ `
        UPDATE users SET email_verified_at = coalesce(email_verified_at, now())
        WHERE id = :userId
      `,
      { userId },
    );
    return { ok: true };
  });
