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

/**
 * At most 30 of those a quarter of an hour from one address. Refused in tRPC's own error shape,
 * one per call in a batch, so the client reads the code and says it in the reader's language.
 */
function authLimiter() {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      const error = {
        message: 'TOO_MANY_REQUESTS',
        code: -32029,
        data: { code: 'TOO_MANY_REQUESTS', httpStatus: 429 },
      };
      const calls = req.path.slice(1).split(',');
      res.status(429).json(req.query.batch ? calls.map(() => ({ error })) : { error });
    },
  });
  return (req: Request, res: Response, next: NextFunction) => {
    // A batched tRPC call names several procedures: /trpc/auth.logIn,songs.sync
    const procedures = req.path.slice(1).split(',');
    if (procedures.some((p) => LIMITED_PROCEDURES.includes(p))) {
      limiter(req, res, next);
      return;
    }
    next();
  };
}

function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  next();
}

/** `limitAuth`: off in tests, which sign in far more often than a person; tested on its own. */
export function createApp(db: Knex, { limitAuth = env.NODE_ENV !== 'test' } = {}) {
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
  if (limitAuth) {
    app.use('/trpc', authLimiter());
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
