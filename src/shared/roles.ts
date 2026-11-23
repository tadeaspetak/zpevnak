/** What can be shared with people: a playlist, and a private song (D127). */
export const SHARED_KINDS = ['playlist', 'song'] as const;
export type SharedKind = (typeof SHARED_KINDS)[number];

/**
 * Who someone is to a shared thing: its owner, someone who edits it with them, or someone who
 * only reads it. Not "editor": that is a person's role in the whole songbook (`isEditor`).
 */
export type MemberRole = 'owner' | 'collaborator' | 'viewer';

/**
 * The roles an invite link gives; the owner is never joined. Editing first, wherever they are
 * listed: the link a band passes round, then the one for whoever only follows along.
 */
export type JoinRole = Exclude<MemberRole, 'owner'>;
export const JOIN_ROLES = [
  'collaborator',
  'viewer',
] as const satisfies readonly JoinRole[];

/** Edits as a member: the owner and collaborators. Deleting and the people stay the owner's. */
export function editsAsMember(role: MemberRole | null): boolean {
  return role === 'owner' || role === 'collaborator';
}
