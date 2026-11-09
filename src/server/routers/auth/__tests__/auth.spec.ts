import { describe, expect, it } from 'vitest';
import { findSessionUser, SESSION_COOKIE } from '../../../auth/sessions.ts';
import {
  callerFor,
  createUser,
  db,
  PASSWORD,
  testOutbox,
  tokenFromLastEmail,
  useCleanDatabase,
  withCookies,
} from '#tests/server/helpers.ts';

useCleanDatabase();

const signUpInput = {
  email: 'Ana@Example.com',
  password: 'a long enough passphrase',
  displayName: 'Ana',
  locale: 'en' as const,
};

async function signedInUser(token: string | null | undefined) {
  if (!token) {
    throw new Error('no session cookie was set');
  }
  return findSessionUser(db, token);
}

describe('auth.signUp', () => {
  it('creates an unverified account, signs it in and emails a verification link', async () => {
    const { api: caller, cookies } = withCookies(null);
    await expect(caller.auth.signUp(signUpInput)).resolves.toEqual({ signedIn: true });

    const user = await signedInUser(cookies[SESSION_COOKIE]);
    expect(user).toMatchObject({
      email: 'ana@example.com',
      displayName: 'Ana',
      role: 'user',
      emailVerified: false,
    });
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0]).toMatchObject({ to: 'ana@example.com' });
    expect(testOutbox[0]?.text).toContain('/verify?token=');
  });

  it('writes the email in the chosen language', async () => {
    await callerFor(null).auth.signUp({ ...signUpInput, locale: 'cs' });
    expect(testOutbox[0]?.subject).toMatch(/Potvrď/);
  });

  it('does not reveal a taken email: same answer, no second account, a heads-up email', async () => {
    await createUser({ email: 'ana@example.com' });
    const { api: caller, cookies } = withCookies(null);
    await expect(caller.auth.signUp(signUpInput)).resolves.toEqual({ signedIn: false });
    expect(cookies[SESSION_COOKIE]).toBeUndefined();
    const { rows } = await db.raw(`SELECT count(*)::int AS n FROM users`);
    expect(rows[0].n).toBe(1);
    // In the existing account's language (cs), not the form's.
    expect(testOutbox.at(-1)?.subject).toBe('Na Zpěvňáku už účet máš');
  });

  it('carries `next` into the verification link, so confirming returns there', async () => {
    await callerFor(null).auth.signUp({
      ...signUpInput,
      next: '/join/AbCdEfGhIjKlMnOpQr',
    });
    expect(testOutbox[0]?.text).toMatch(
      /\/verify\?token=[^&\s]+&next=%2Fjoin%2FAbCdEfGhIjKlMnOpQr/,
    );
  });

  it('refuses a `next` that leaves the app', async () => {
    await expect(
      callerFor(null).auth.signUp({ ...signUpInput, next: '//evil.example' }),
    ).rejects.toThrow();
  });

  it('refuses a short password', async () => {
    await expect(
      callerFor(null).auth.signUp({ ...signUpInput, password: 'short' }),
    ).rejects.toThrow();
  });
});

describe('auth.verifyEmail', () => {
  it('verifies the account with the emailed token, once', async () => {
    const { api: caller, cookies } = withCookies(null);
    await caller.auth.signUp(signUpInput);
    const token = tokenFromLastEmail();

    await expect(callerFor(null).auth.verifyEmail({ token })).resolves.toEqual({
      ok: true,
    });
    const user = await signedInUser(cookies[SESSION_COOKIE]);
    expect(user?.emailVerified).toBe(true);

    await expect(callerFor(null).auth.verifyEmail({ token })).rejects.toThrow(
      'INVALID_TOKEN',
    );
  });

  it('refuses an unknown token', async () => {
    await expect(
      callerFor(null).auth.verifyEmail({ token: 'x'.repeat(43) }),
    ).rejects.toThrow('INVALID_TOKEN');
  });

  it('refuses an expired token', async () => {
    await callerFor(null).auth.signUp(signUpInput);
    await db.raw(`UPDATE auth_tokens SET expires_at = now() - interval '1 second'`);
    await expect(
      callerFor(null).auth.verifyEmail({ token: tokenFromLastEmail() }),
    ).rejects.toThrow('INVALID_TOKEN');
  });

  it('a resent link replaces the old one', async () => {
    const { api: caller, cookies } = withCookies(null);
    await caller.auth.signUp(signUpInput);
    const first = tokenFromLastEmail();
    const user = await signedInUser(cookies[SESSION_COOKIE]);
    await callerFor(user).auth.resendVerification();
    const second = tokenFromLastEmail();

    await expect(callerFor(null).auth.verifyEmail({ token: first })).rejects.toThrow();
    await expect(
      callerFor(null).auth.verifyEmail({ token: second }),
    ).resolves.toBeTruthy();
  });
});

describe('auth.logIn', () => {
  it('signs in with the right password, whatever the email case', async () => {
    const user = await createUser({ email: 'bob@example.com' });
    const { api: caller, cookies } = withCookies(null);
    await caller.auth.logIn({ email: ' BOB@example.com ', password: PASSWORD });
    expect(await signedInUser(cookies[SESSION_COOKIE])).toMatchObject({
      id: user.id,
    });
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await createUser({ email: 'bob@example.com' });
    await expect(
      callerFor(null).auth.logIn({
        email: 'bob@example.com',
        password: 'wrong password',
      }),
    ).rejects.toThrow('INVALID_CREDENTIALS');
    await expect(
      callerFor(null).auth.logIn({ email: 'nobody@example.com', password: PASSWORD }),
    ).rejects.toThrow('INVALID_CREDENTIALS');
  });
});

describe('auth.logOut', () => {
  it('ends the session', async () => {
    await createUser({ email: 'bob@example.com' });
    const { api: login, cookies: loginCookies } = withCookies(null);
    await login.auth.logIn({ email: 'bob@example.com', password: PASSWORD });
    const token = loginCookies[SESSION_COOKIE] as string;
    const user = await signedInUser(token);

    const { api: caller, cookies } = withCookies(user, token);
    await caller.auth.logOut();
    expect(cookies[SESSION_COOKIE]).toBeNull();
    expect(await findSessionUser(db, token)).toBeNull();
  });
});

describe('password reset', () => {
  it('sets the new password, signs out other devices and verifies the email', async () => {
    await createUser({ email: 'bob@example.com', verified: false });
    const { api: otherDevice, cookies: otherCookies } = withCookies(null);
    await otherDevice.auth.logIn({ email: 'bob@example.com', password: PASSWORD });
    const oldToken = otherCookies[SESSION_COOKIE] as string;

    await callerFor(null).auth.requestPasswordReset({ email: 'bob@example.com' });
    expect(testOutbox.at(-1)?.text).toContain('/reset-password?token=');

    const { api: caller, cookies } = withCookies(null);
    await caller.auth.resetPassword({
      token: tokenFromLastEmail(),
      password: 'a brand new passphrase',
    });

    expect(await findSessionUser(db, oldToken)).toBeNull();
    const user = await signedInUser(cookies[SESSION_COOKIE]);
    expect(user?.emailVerified).toBe(true);
    await expect(
      callerFor(null).auth.logIn({
        email: 'bob@example.com',
        password: 'a brand new passphrase',
      }),
    ).resolves.toBeTruthy();
    await expect(
      callerFor(null).auth.logIn({ email: 'bob@example.com', password: PASSWORD }),
    ).rejects.toThrow('INVALID_CREDENTIALS');
  });

  it('answers the same for an unknown email, and sends nothing', async () => {
    await expect(
      callerFor(null).auth.requestPasswordReset({ email: 'nobody@example.com' }),
    ).resolves.toEqual({ ok: true });
    expect(testOutbox).toHaveLength(0);
  });
});

describe('auth.me', () => {
  it('returns null when signed out, and only the allowed fields when signed in', async () => {
    expect(await callerFor(null).auth.me()).toBeNull();
    const user = await createUser();
    expect(Object.keys((await callerFor(user).auth.me()) ?? {}).sort()).toEqual(
      ['displayName', 'email', 'emailVerified', 'id', 'locale', 'role'].sort(),
    );
  });
});
