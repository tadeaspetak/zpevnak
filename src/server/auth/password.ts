import { hash, verify } from '@node-rs/argon2';

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

// Verified against when the email is unknown, so a miss takes as long as a wrong password.
const DUMMY_HASH = await hash('not-a-real-password');

export async function verifyPassword(stored: string | null, password: string) {
  if (stored === null) {
    await verify(DUMMY_HASH, password);
    return false;
  }
  return verify(stored, password);
}
