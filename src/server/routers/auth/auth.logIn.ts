import { z } from 'zod';
import { emailSchema } from '#shared/validators/index.ts';
import { setSessionCookie } from '../../auth/cookies.ts';
import { verifyPassword } from '../../auth/password.ts';
import { createSession } from '../../auth/sessions.ts';
import { fail, publicProcedure } from '../../trpc/trpc.ts';

export const logIn = publicProcedure
  // No password rules here: an account made under older rules must still be able to log in.
  .input(z.object({ email: emailSchema, password: z.string().min(1).max(200) }))
  .mutation(async ({ ctx, input }) => {
    const { rows } = await ctx.db.raw(
      /* sql */ `SELECT id, password_hash FROM users WHERE lower(email) = :email`,
      { email: input.email },
    );
    const row = rows[0];
    const ok = await verifyPassword(row?.password_hash ?? null, input.password);
    if (!row || !ok) {
      fail('UNAUTHORIZED', 'INVALID_CREDENTIALS');
    }
    setSessionCookie(ctx.res, await createSession(ctx.db, row.id));
    return { ok: true };
  });
