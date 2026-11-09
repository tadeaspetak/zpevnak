import { z } from 'zod';
import { passwordSchema, tokenSchema } from '#shared/validators/index.ts';
import { setSessionCookie } from '../../auth/cookies.ts';
import { consumeEmailToken } from '../../auth/emailTokens.ts';
import { hashPassword } from '../../auth/password.ts';
import { createSession, deleteUserSessions } from '../../auth/sessions.ts';
import { fail, publicProcedure } from '../../trpc/trpc.ts';

/**
 * Sets the new password, signs out every other device and signs this one in. The link came
 * to the inbox, so following it also proves the email: it counts as verified.
 */
export const resetPasswordProcedure = publicProcedure
  .input(z.object({ token: tokenSchema, password: passwordSchema }))
  .mutation(async ({ ctx, input }) => {
    const userId = await consumeEmailToken(ctx.db, input.token, 'reset_password');
    if (userId === null) {
      fail('BAD_REQUEST', 'INVALID_TOKEN');
    }
    const passwordHash = await hashPassword(input.password);
    await ctx.db.raw(
      /* sql */ `
        UPDATE users
        SET password_hash = :passwordHash,
            email_verified_at = coalesce(email_verified_at, now())
        WHERE id = :userId
      `,
      { passwordHash, userId },
    );
    await deleteUserSessions(ctx.db, userId);
    setSessionCookie(ctx.res, await createSession(ctx.db, userId));
    return { ok: true };
  });
