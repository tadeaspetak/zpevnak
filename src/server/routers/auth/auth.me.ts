import { toMe } from '../../auth/me.ts';
import { publicProcedure } from '../../trpc/trpc.ts';

export const me = publicProcedure.query(({ ctx }) => (ctx.user ? toMe(ctx.user) : null));
