import type { Request, Response } from 'express';
import { afterAll, beforeEach } from 'vitest';
import type { Role } from '#shared/validators/index.ts';
import { hashPassword } from '../../src/server/auth/password.ts';
import type { SessionUser } from '../../src/server/auth/sessions.ts';
import { db } from '../../src/server/db/knex.ts';
import { testOutbox } from '../../src/server/email/send.ts';
import { appRouter } from '../../src/server/routers/index.ts';

export { db, testOutbox };

export const PASSWORD = 'correct horse battery';

/** Truncates every table before each test, and closes the pool after the file. */
export function useCleanDatabase() {
  beforeEach(async () => {
    await db.raw(/* sql */ `
      TRUNCATE users, sessions, auth_tokens, songs, song_versions, song_deletions, playlists,
        playlist_songs
      RESTART IDENTITY CASCADE
    `);
    testOutbox.length = 0;
  });
  afterAll(async () => {
    await db.destroy();
  });
}

let userCount = 0;

export async function createUser(
  options: { role?: Role; verified?: boolean; email?: string } = {},
): Promise<SessionUser> {
  userCount += 1;
  const email = options.email ?? `user${userCount}@example.com`;
  const { rows } = await db.raw(
    /* sql */ `
      INSERT INTO users (email, display_name, password_hash, role, email_verified_at)
      VALUES (:email, :name, :hash, :role, CASE WHEN :verified THEN now() END)
      RETURNING id, locale
    `,
    {
      email,
      name: `User ${userCount}`,
      hash: await hashPassword(PASSWORD),
      role: options.role ?? 'user',
      verified: options.verified ?? true,
    },
  );
  return {
    id: rows[0].id,
    email,
    displayName: `User ${userCount}`,
    role: options.role ?? 'user',
    locale: rows[0].locale,
    emailVerified: options.verified ?? true,
  };
}

export type FakeResponse = Response & { cookies: Record<string, string | null> };

function fakeResponse(): FakeResponse {
  const cookies: Record<string, string | null> = {};
  return {
    cookies,
    cookie(name: string, value: string) {
      cookies[name] = value;
      return this;
    },
    clearCookie(name: string) {
      cookies[name] = null;
      return this;
    },
  } as unknown as FakeResponse;
}

/** A tRPC caller acting as `user` (null: signed out). */
export function callerFor(user: SessionUser | null, sessionToken: string | null = null) {
  return withCookies(user, sessionToken).api;
}

/** A caller plus the cookies its calls set, for specs about signing in and out. */
export function withCookies(
  user: SessionUser | null,
  sessionToken: string | null = null,
) {
  const res = fakeResponse();
  const api = appRouter.createCaller({
    db,
    req: { cookies: {} } as Request,
    res,
    user,
    sessionToken,
  });
  return { api, cookies: res.cookies };
}

/** The token in the last email's link. */
export function tokenFromLastEmail(): string {
  const text = testOutbox.at(-1)?.text ?? '';
  const match = /token=([^\s&]+)/.exec(text);
  if (!match?.[1]) {
    throw new Error(`No token link in the last email: ${text}`);
  }
  return decodeURIComponent(match[1]);
}

export const SONG = (title = 'Test Song', artist = 'Someone') =>
  `{title: ${title}}\n{artist: ${artist}}\n\n{sov}\n[A]la la [D]la\n{eov}\n`;

/** When a song was last changed, as a client that has just loaded it would send it (D106). */
export async function seenAt(songId: number): Promise<string> {
  const { rows } = await db.raw(
    /* sql */ `SELECT updated_at FROM songs WHERE id = :songId`,
    {
      songId,
    },
  );
  return (rows[0].updated_at as Date).toISOString();
}
