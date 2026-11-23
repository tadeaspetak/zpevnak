import { randomBytes } from 'node:crypto';
import type { Knex } from 'knex';

/** The secret in an invite link: 128 bits, URL-safe. */
export function newInviteToken(): string {
  return randomBytes(16).toString('base64url');
}

export type InvitePreview = { name: string; ownerName: string; publicId: number | null };

/**
 * What an invite link leads to, or null for a link that leads nowhere. The link is the
 * permission: whoever holds it may see the playlist's name and owner, and a public playlist's id.
 */
export async function loadInvitePreview(
  db: Knex,
  token: string,
): Promise<InvitePreview | null> {
  const { rows } = await db.raw(
    /* sql */ `
      SELECT p.id, p.name, p.is_public, u.display_name AS owner_name
      FROM playlists p JOIN users u ON u.id = p.owner_id
      WHERE p.invite_token = :token
    `,
    { token },
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    name: row.name as string,
    ownerName: row.owner_name as string,
    publicId: row.is_public ? Number(row.id) : null,
  };
}
