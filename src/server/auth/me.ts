import type { SessionUser } from './sessions.ts';

/** What the client learns about the signed-in user. An allow-list: never spread a row here. */
export function toMe(user: SessionUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    locale: user.locale,
    emailVerified: user.emailVerified,
  };
}
export type Me = ReturnType<typeof toMe>;
