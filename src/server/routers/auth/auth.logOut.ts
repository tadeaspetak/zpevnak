import { clearSessionCookie } from '../../auth/cookies.ts';
import { deleteSession } from '../../auth/sessions.ts';
import { publicProcedure } from '../../trpc/trpc.ts';

export const logOut = publicProcedure.mutation(async ({ ctx }) => {
  if (ctx.sessionToken) {
    await deleteSession(ctx.db, ctx.sessionToken);
  }
  clearSessionCookie(ctx.res);
  return { ok: true };
});
