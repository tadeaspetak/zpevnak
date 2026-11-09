import type { Knex } from 'knex';
import { generateToken, hashToken } from './tokens.ts';

export type TokenPurpose = 'verify_email' | 'reset_password';

const LIFETIME_HOURS: Record<TokenPurpose, number> = {
  verify_email: 72,
  reset_password: 1,
};

/** Issues a single-use token. Older tokens of the same purpose stop working. */
export async function issueEmailToken(
  db: Knex,
  userId: number,
  purpose: TokenPurpose,
): Promise<string> {
  const { token, hash } = generateToken();
  await db.transaction(async (trx) => {
    await trx.raw(
      /* sql */ `DELETE FROM auth_tokens WHERE user_id = :userId AND purpose = :purpose`,
      { userId, purpose },
    );
    await trx.raw(
      /* sql */ `
        INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at)
        VALUES (:hash, :userId, :purpose, now() + make_interval(hours => :hours))
      `,
      { hash, userId, purpose, hours: LIFETIME_HOURS[purpose] },
    );
  });
  return token;
}

/** Uses up a token. Returns its user, or null when it is unknown, used or expired. */
export async function consumeEmailToken(
  db: Knex,
  token: string,
  purpose: TokenPurpose,
): Promise<number | null> {
  const { rows } = await db.raw(
    /* sql */ `
      DELETE FROM auth_tokens
      WHERE token_hash = :hash AND purpose = :purpose
      RETURNING user_id, expires_at > now() AS valid
    `,
    { hash: hashToken(token), purpose },
  );
  const row = rows[0];
  return row?.valid ? row.user_id : null;
}
