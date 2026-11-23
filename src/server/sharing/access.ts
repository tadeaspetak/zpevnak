import type { Knex } from 'knex';
import type { MemberRole, SharedKind } from '#shared/roles.ts';
import type { SessionUser } from '../auth/sessions.ts';
import { loadVisiblePlaylist, type PlaylistRecord } from '../playlists/load.ts';
import { loadSong } from '../songs/load.ts';
import type { SongRecord } from '../songs/record.ts';
import { fail } from '../trpc/trpc.ts';

/** A shared thing as its viewer gets it, said which kind it is. */
export type SharedRecord =
  { kind: 'playlist'; playlist: PlaylistRecord } | { kind: 'song'; song: SongRecord };

/**
 * The thing as `viewer` may see it, or NOT_FOUND: what they may not see doesn't exist for them
 * (a private playlist or song).
 */
export async function loadShared(
  db: Knex,
  kind: SharedKind,
  id: number,
  viewer: SessionUser | null,
): Promise<SharedRecord> {
  switch (kind) {
    case 'playlist':
      return { kind, playlist: await loadVisiblePlaylist(db, id, viewer) };
    case 'song':
      return { kind, song: await loadSong(db, id, viewer) };
  }
}

function roleIn(shared: SharedRecord): MemberRole | null {
  return shared.kind === 'playlist' ? shared.playlist.role : shared.song.role;
}

/** Anyone in it, a reader too: sees who else is, and may leave. */
export async function assertMemberOf(
  db: Knex,
  kind: SharedKind,
  id: number,
  viewer: SessionUser,
): Promise<SharedRecord & { role: MemberRole }> {
  const shared = await loadShared(db, kind, id, viewer);
  const role = roleIn(shared);
  if (!role) {
    fail('FORBIDDEN', 'FORBIDDEN');
  }
  return { ...shared, role };
}

/** Only the owner hands out links and manages the people. */
export async function assertOwnerOf(
  db: Knex,
  kind: SharedKind,
  id: number,
  viewer: SessionUser,
): Promise<SharedRecord> {
  const shared = await assertMemberOf(db, kind, id, viewer);
  if (shared.role !== 'owner') {
    fail('FORBIDDEN', 'FORBIDDEN');
  }
  return shared;
}
