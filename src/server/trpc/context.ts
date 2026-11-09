import type { Request, Response } from 'express';
import type { Knex } from 'knex';
import { findSessionUser, SESSION_COOKIE, type SessionUser } from '../auth/sessions.ts';

export type Context = {
  db: Knex;
  req: Request;
  res: Response;
  user: SessionUser | null;
  sessionToken: string | null;
};

export async function createContext(
  db: Knex,
  req: Request,
  res: Response,
): Promise<Context> {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  const sessionToken = typeof token === 'string' && token ? token : null;
  const user = sessionToken ? await findSessionUser(db, sessionToken) : null;
  return { db, req, res, user, sessionToken: user ? sessionToken : null };
}
