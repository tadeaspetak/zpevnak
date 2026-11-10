import { initTRPC, TRPCError } from '@trpc/server';
import type { ErrorCode } from '#shared/errors.ts';
import { isEditor } from '#shared/songs.ts';
import type { Context } from './context.ts';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export function fail(code: TRPCError['code'], message: ErrorCode): never {
  throw new TRPCError({ code, message });
}

export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    fail('UNAUTHORIZED', 'NOT_SIGNED_IN');
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Adding songs and playlists needs a confirmed email, so a typo'd address can't own content. */
export const verifiedProcedure = authedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.emailVerified) {
    fail('FORBIDDEN', 'EMAIL_NOT_VERIFIED');
  }
  return next();
});

export const editorProcedure = verifiedProcedure.use(({ ctx, next }) => {
  if (!isEditor(ctx.user)) {
    fail('FORBIDDEN', 'FORBIDDEN');
  }
  return next();
});

export const adminProcedure = verifiedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    fail('FORBIDDEN', 'FORBIDDEN');
  }
  return next();
});
