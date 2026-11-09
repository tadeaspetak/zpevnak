import { z } from 'zod';
import { emailSchema } from '#shared/validators/index.ts';
import { issueEmailToken } from '../../auth/emailTokens.ts';
import { sendEmail } from '../../email/send.ts';
import { resetPassword } from '../../email/templates.ts';
import { publicProcedure } from '../../trpc/trpc.ts';

/** Answers the same whether or not the email has an account. */
export const requestPasswordReset = publicProcedure
  .input(z.object({ email: emailSchema }))
  .mutation(async ({ ctx, input }) => {
    const { rows } = await ctx.db.raw(
      /* sql */ `SELECT id, email, locale FROM users WHERE lower(email) = :email`,
      { email: input.email },
    );
    const user = rows[0];
    if (user) {
      const token = await issueEmailToken(ctx.db, user.id, 'reset_password');
      await sendEmail(resetPassword(user.email, user.locale, token));
    }
    return { ok: true };
  });
