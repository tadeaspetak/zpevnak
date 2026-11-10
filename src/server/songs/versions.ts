import type { Knex } from 'knex';

export type SongVersionKind = 'create' | 'edit' | 'approve' | 'reject';

/**
 * Records the song's text as it now stands in `songs` as a new version (D86). Call it in the
 * same transaction as the save, after it, so the version is exactly what was stored.
 * `savedBy` is null only for the seed, whose songs have no author either. A rejection keeps its
 * reason and note: the song forgets them once fixed (D81), its history doesn't.
 */
export async function recordVersion(
  db: Knex,
  songId: number,
  kind: SongVersionKind,
  savedBy: number | null,
) {
  await db.raw(
    /* sql */ `
      INSERT INTO song_versions
        (song_id, kind, source, title, artist, saved_by, rejection_reason, rejection_note)
      SELECT id, :kind, source, title, artist, :savedBy, rejection_reason, rejection_note
      FROM songs WHERE id = :songId
    `,
    { songId, kind, savedBy },
  );
}
