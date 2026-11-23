import { z } from 'zod';
import {
  SONG_COLUMNS,
  SONG_READABLE,
  toSongRecord,
  type SongRow,
} from '../../songs/record.ts';
import { publicProcedure } from '../../trpc/trpc.ts';

// Rows committed by a transaction that started before the previous cursor can carry an
// earlier timestamp. Re-reading a minute back catches them; the client merges by id.
const OVERLAP = "interval '1 minute'";

/**
 * Public songs that changed since `since` (an earlier response's cursor), or every one for null.
 * Rejected songs come too, marked: they stay in playlists (D77); the device keeps them out of
 * search. Private songs the viewer may read come whole every time (a handful per person): being
 * shared one, or no longer, doesn't change the song, so a cursor would never notice. The device
 * drops any private song not sent (D127). `removedIds` are public songs deleted since, or gone
 * private: the device drops them.
 */
export const sync = publicProcedure
  .input(z.object({ since: z.iso.datetime().nullable() }))
  .query(async ({ ctx, input }) => {
    const { rows: clock } = await ctx.db.raw(/* sql */ `SELECT now() AS now`);
    const bindings = { since: input.since, viewerId: ctx.user?.id ?? null };
    const { rows } = await ctx.db.raw<{ rows: SongRow[] }>(
      /* sql */ `
        SELECT ${SONG_COLUMNS}
        FROM songs s
        WHERE (
          s.status <> 'private'
          AND (:since::timestamptz IS NULL OR s.updated_at > :since::timestamptz - ${OVERLAP})
        ) OR (s.status = 'private' AND ${SONG_READABLE})
      `,
      bindings,
    );
    const { rows: removed } = input.since
      ? await ctx.db.raw<{ rows: { song_id: number }[] }>(
          /* sql */ `
            SELECT song_id FROM song_deletions
            WHERE deleted_at > :since::timestamptz - ${OVERLAP}
            UNION
            SELECT song_id FROM song_withdrawals
            WHERE withdrawn_at > :since::timestamptz - ${OVERLAP}
          `,
          bindings,
        )
      : { rows: [] };
    // Gone private and back, or private and shared with this viewer: it is here, not gone.
    const sent = new Set(rows.map((r) => Number(r.id)));
    return {
      songs: rows.map((row) => toSongRecord(row, ctx.user)),
      removedIds: removed.map((r) => Number(r.song_id)).filter((id) => !sent.has(id)),
      cursor: (clock[0].now as Date).toISOString(),
    };
  });
