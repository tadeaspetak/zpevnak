import { randomBytes } from 'node:crypto';
import type { Knex } from 'knex';
import { SHARED_KINDS, type JoinRole, type SharedKind } from '#shared/roles.ts';
import { SHARED_TABLES } from './tables.ts';

/** The secret in an invite link: 128 bits, URL-safe. */
export function newInviteToken(): string {
  return randomBytes(16).toString('base64url');
}

export type Invite = { kind: SharedKind; id: number; ownerId: number; role: JoinRole };

/** What an invite token leads to, and the role it gives; null if nothing. */
export async function findInvite(db: Knex, token: string): Promise<Invite | null> {
  for (const kind of SHARED_KINDS) {
    const { things, owner } = SHARED_TABLES[kind];
    const { rows } = await db.raw(
      /* sql */ `
        SELECT id, ${owner} AS owner_id,
               CASE WHEN invite_token = :token THEN 'collaborator' ELSE 'viewer' END AS role
        FROM ${things}
        WHERE invite_token = :token OR view_token = :token
      `,
      { token },
    );
    const row = rows[0];
    if (row) {
      return { kind, id: Number(row.id), ownerId: Number(row.owner_id), role: row.role };
    }
  }
  return null;
}

export type InvitePreview = {
  kind: SharedKind;
  name: string;
  ownerName: string;
  /** A public thing's id: there is something to look at without joining. */
  publicId: number | null;
  role: JoinRole;
};

/**
 * What an invite link leads to, or null for a link that leads nowhere. The link is the
 * permission: whoever holds it may see the name and owner, a public thing's id, and what
 * joining by it lets them do.
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
    { id: invite.id },
  );
  const row = rows[0];
  return {
    kind: invite.kind,
    name: row.name as string,
    ownerName: row.owner_name as string,
    publicId: row.is_public ? Number(row.id) : null,
    role: invite.role,
  };
}
