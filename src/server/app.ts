import { createExpressMiddleware } from '@trpc/server/adapters/express';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Knex } from 'knex';
import { env } from './env.ts';
import { appRouter } from './routers/index.ts';
import { createContext } from './trpc/context.ts';

// Procedures a stranger could hammer: guessing passwords, or making us send email.
const LIMITED_PROCEDURES = [
  'auth.logIn',
  'auth.signUp',
  'auth.requestPasswordReset',
  'auth.resendVerification',
];

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { message: 'TOO_MANY_REQUESTS' } },
});

function limitAuth(req: Request, res: Response, next: NextFunction) {
  // A batched tRPC call names several procedures: /trpc/auth.logIn,songs.sync
  const procedures = req.path.slice(1).split(',');
  if (procedures.some((p) => LIMITED_PROCEDURES.includes(p))) {
    authLimiter(req, res, next);
    return;
  }
  next();
}

function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  next();
}

export function createApp(db: Knex) {
  const app = express();
  app.disable('x-powered-by');
  // Cloud Run puts one proxy in front; rate limiting needs the client's address.
  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(cookieParser());
  // Not /healthz: Cloud Run reserves paths ending in z, and answers them itself with a 404.
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  if (env.NODE_ENV !== 'test') {
    app.use('/trpc', limitAuth);
  }
  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }) => createContext(db, req, res),
    }),
  );
  return app;
}
