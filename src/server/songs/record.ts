import type { RejectionReason, SongStatus } from '#shared/validators/index.ts';
import type { SessionUser } from '../auth/sessions.ts';

/** Columns every song read selects, for `toSongRecord`. */
export const SONG_COLUMNS = /* sql */ `
  s.id, s.title, s.artist, s.source, s.status, s.rejection_reason, s.rejection_note,
  s.created_by, s.created_at, s.updated_at
`;

export type SongRow = {
  id: number;
  title: string;
  artist: string | null;
  source: string;
  status: SongStatus;
  rejection_reason: RejectionReason | null;
  rejection_note: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
};

export function isEditor(user: SessionUser | null): boolean {
  return user?.role === 'editor' || user?.role === 'admin';
}

/**
 * Rejected songs leave the catalog. Their author still sees them, with the reason, so they
 * can fix and resubmit; editors see them in the queue.
 */
export function canSeeSong(
  song: { status: SongStatus; created_by: number | null },
  viewer: SessionUser | null,
): boolean {
  return song.status !== 'rejected' || song.created_by === viewer?.id || isEditor(viewer);
}

/** Whether the song belongs in this viewer's catalog (search, offline copy). Editors meet
 * rejected songs in the queue, not in search. */
export function inCatalog(
  song: { status: SongStatus; created_by: number | null },
  viewer: SessionUser | null,
): boolean {
  return song.status !== 'rejected' || song.created_by === viewer?.id;
}

/** The song as the client gets it. An allow-list: never spread a row here. */
export function toSongRecord(row: SongRow, viewer: SessionUser | null) {
  const seesRejection = row.created_by === viewer?.id || isEditor(viewer);
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    source: row.source,
    status: row.status,
    rejection:
      seesRejection && row.rejection_reason
        ? { reason: row.rejection_reason, note: row.rejection_note }
        : null,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
export type SongRecord = ReturnType<typeof toSongRecord>;
