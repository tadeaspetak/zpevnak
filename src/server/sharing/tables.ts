import type { JoinRole, SharedKind } from '#shared/roles.ts';

/**
 * Where each kind of shared thing keeps its owner, its people and its undoable removals. Two
 * tables per kind rather than one for all: foreign keys and plain queries. Written into SQL:
 * constants, never input.
 */
export const SHARED_TABLES = {
  playlist: {
    things: 'playlists',
    owner: 'owner_id',
    members: 'playlist_collaborators',
    removals: 'playlist_collaborator_removals',
    key: 'playlist_id',
  },
  song: {
    things: 'songs',
    owner: 'created_by',
    members: 'song_members',
    removals: 'song_member_removals',
    key: 'song_id',
  },
} as const satisfies Record<
  SharedKind,
  { things: string; owner: string; members: string; removals: string; key: string }
>;

/** Where each role's invite token is kept, the same columns in every kind's table. */
export const INVITE_COLUMN = {
  collaborator: 'invite_token',
  viewer: 'view_token',
} as const satisfies Record<JoinRole, string>;
