import { z } from 'zod';
import {
  displayNameSchema,
  emailSchema,
  localeSchema,
  passwordSchema,
} from '#shared/validators/index.ts';
import { setSessionCookie } from '../../auth/cookies.ts';
import { issueEmailToken } from '../../auth/emailTokens.ts';
import { hashPassword } from '../../auth/password.ts';
import { createSession } from '../../auth/sessions.ts';
import { sendEmail } from '../../email/send.ts';
import { alreadyRegistered, verifyEmail } from '../../email/templates.ts';
import { publicProcedure } from '../../trpc/trpc.ts';

/**
 * Creates the account and signs it in; the account can browse straight away and add content
 * once the email is confirmed. A taken email gets a "you already have an account" email and
 * the same response, so the form never tells a stranger who is registered.
 */
export const signUp = publicProcedure
  .input(
    z.object({
      email: emailSchema,
      password: passwordSchema,
      displayName: displayNameSchema,
      locale: localeSchema,
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const passwordHash = await hashPassword(input.password);
    const { rows } = await ctx.db.raw(
      /* sql */ `
        INSERT INTO users (email, display_name, password_hash, locale)
        VALUES (:email, :displayName, :passwordHash, :locale)
        ON CONFLICT (lower(email)) DO NOTHING
        RETURNING id
      `,
      { ...input, passwordHash },
    );
    const userId: number | undefined = rows[0]?.id;
    if (userId === undefined) {
      const { rows: existing } = await ctx.db.raw(
        /* sql */ `SELECT locale FROM users WHERE lower(email) = :email`,
        { email: input.email },
      );
      await sendEmail(
        alreadyRegistered(input.email, existing[0]?.locale ?? input.locale),
      );
      return { signedIn: false };
    }
    const token = await issueEmailToken(ctx.db, userId, 'verify_email');
    await sendEmail(verifyEmail(input.email, input.locale, token));
    setSessionCookie(ctx.res, await createSession(ctx.db, userId));
    return { signedIn: true };
  });
