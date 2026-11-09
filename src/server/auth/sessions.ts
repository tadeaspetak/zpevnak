import type { Knex } from 'knex';
import type { Locale, Role } from '#shared/validators/index.ts';
import { generateToken, hashToken } from './tokens.ts';

export const SESSION_COOKIE = 'zp_session';
// A year: a musician opening the app at a gig should never meet a login screen.
export const SESSION_DAYS = 365;

export type SessionUser = {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  locale: Locale;
  emailVerified: boolean;
};

export async function createSession(db: Knex, userId: number): Promise<string> {
  const { token, hash } = generateToken();
  await db.raw(
    /* sql */ `
      INSERT INTO sessions (token_hash, user_id, expires_at)
      VALUES (:hash, :userId, now() + make_interval(days => :days))
    `,
    { hash, userId, days: SESSION_DAYS },
  );
  return token;
}

export async function findSessionUser(
  db: Knex,
  token: string,
): Promise<SessionUser | null> {
  const { rows } = await db.raw(
    /* sql */ `
      SELECT u.id, u.email, u.display_name, u.role, u.locale, u.email_verified_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = :hash AND s.expires_at > now()
    `,
    { hash: hashToken(token) },
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    locale: row.locale,
    emailVerified: row.email_verified_at !== null,
  };
}

export async function deleteSession(db: Knex, token: string): Promise<void> {
  await db.raw(/* sql */ `DELETE FROM sessions WHERE token_hash = :hash`, {
    hash: hashToken(token),
  });
}

export async function deleteUserSessions(db: Knex, userId: number): Promise<void> {
  await db.raw(/* sql */ `DELETE FROM sessions WHERE user_id = :userId`, { userId });
}
