import { randomBytes } from 'node:crypto';
import type { Knex } from 'knex';
import type { JoinRole } from '#shared/roles.ts';

/** The secret in an invite link: 128 bits, URL-safe. */
export function newInviteToken(): string {
  return randomBytes(16).toString('base64url');
}

/** Where each role's invite token is kept. Written into SQL: never from input. */
export const INVITE_COLUMN = {
  collaborator: 'invite_token',
  viewer: 'view_token',
} as const satisfies Record<JoinRole, string>;

/** The playlist an invite token belongs to, and the role it gives; null if none. */
export async function findInvite(
  db: Knex,
  token: string,
): Promise<{ playlistId: number; ownerId: number; role: JoinRole } | null> {
  const { rows } = await db.raw(
    /* sql */ `
      SELECT id, owner_id,
             CASE WHEN invite_token = :token THEN 'collaborator' ELSE 'viewer' END AS role
      FROM playlists
      WHERE invite_token = :token OR view_token = :token
    `,
    { token },
  );
  const row = rows[0];
  return row
    ? { playlistId: Number(row.id), ownerId: Number(row.owner_id), role: row.role }
    : null;
}

export type InvitePreview = {
  name: string;
  ownerName: string;
  publicId: number | null;
  role: JoinRole;
};

/**
 * What an invite link leads to, or null for a link that leads nowhere. The link is the
 * permission: whoever holds it may see the playlist's name and owner, a public playlist's id,
 * and what joining by it lets them do.
 */
export async function loadInvitePreview(
  db: Knex,
  token: string,
): Promise<InvitePreview | null> {
  const invite = await findInvite(db, token);
  if (!invite) {
    return null;
  }
  const { rows } = await db.raw(
    /* sql */ `
      SELECT p.id, p.name, p.is_public, u.display_name AS owner_name
      FROM playlists p JOIN users u ON u.id = p.owner_id
      WHERE p.id = :id
    `,
    { id: invite.playlistId },
  );
  const row = rows[0];
  return {
    name: row.name as string,
    ownerName: row.owner_name as string,
    publicId: row.is_public ? Number(row.id) : null,
    role: invite.role,
  };
}
