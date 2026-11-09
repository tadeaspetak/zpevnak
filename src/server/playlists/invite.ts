import { randomBytes } from 'node:crypto';

/** The secret in an invite link: 128 bits, URL-safe. */
export function newInviteToken(): string {
  return randomBytes(16).toString('base64url');
}
