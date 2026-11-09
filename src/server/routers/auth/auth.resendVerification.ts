import { z } from 'zod';
import { appPathSchema } from '#shared/validators/index.ts';
import { issueEmailToken } from '../../auth/emailTokens.ts';
import { sendEmail } from '../../email/send.ts';
import { verifyEmail } from '../../email/templates.ts';
import { authedProcedure } from '../../trpc/trpc.ts';

export const resendVerification = authedProcedure
  .input(z.object({ next: appPathSchema.optional() }).optional())
  .mutation(async ({ ctx, input }) => {
    if (ctx.user.emailVerified) {
      return { ok: true };
    }
    const token = await issueEmailToken(ctx.db, ctx.user.id, 'verify_email');
    await sendEmail(
      verifyEmail(ctx.user.email, ctx.user.locale, token, input?.next ?? null),
    );
    return { ok: true };
  });
