/**
 * Who someone is to a playlist: its owner, someone who edits it with them, or someone who only
 * reads it. Not "editor": that is a person's role in the whole songbook (`isEditor`).
 */
export type PlaylistRole = 'owner' | 'collaborator' | 'viewer';

/**
 * The roles an invite link gives; the owner is never joined. Editing first, wherever they are
 * listed: the link a band passes round, then the one for whoever only follows along.
 */
export type JoinRole = Exclude<PlaylistRole, 'owner'>;
export const JOIN_ROLES = [
  'collaborator',
  'viewer',
] as const satisfies readonly JoinRole[];

/** Changes the songs and the name. Deleting, visibility and the people stay the owner's. */
export function canEditPlaylist(role: PlaylistRole | null): boolean {
  return role === 'owner' || role === 'collaborator';
}
