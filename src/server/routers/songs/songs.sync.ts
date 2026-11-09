import { z } from 'zod';
import { SONG_COLUMNS, toSongRecord, type SongRow } from '../../songs/record.ts';
import { publicProcedure } from '../../trpc/trpc.ts';

// Rows committed by a transaction that started before the previous cursor can carry an
// earlier timestamp. Re-reading a minute back catches them; the client merges by id.
const OVERLAP = "interval '1 minute'";

/**
 * Everything that changed since `since` (an earlier response's cursor), or every song for null.
 * Rejected songs come too, marked: they stay in playlists (D77); the device keeps them out of
 * search. `removedIds` are songs deleted since: the device drops them.
 */
export const sync = publicProcedure
  .input(z.object({ since: z.iso.datetime().nullable() }))
  .query(async ({ ctx, input }) => {
    const { rows: clock } = await ctx.db.raw(/* sql */ `SELECT now() AS now`);
    const { rows } = await ctx.db.raw<{ rows: SongRow[] }>(
      /* sql */ `
        SELECT ${SONG_COLUMNS}
        FROM songs s
        WHERE :since::timestamptz IS NULL OR s.updated_at > :since::timestamptz - ${OVERLAP}
      `,
      { since: input.since },
    );
    const { rows: deleted } = input.since
      ? await ctx.db.raw<{ rows: { song_id: number }[] }>(
          /* sql */ `
            SELECT song_id FROM song_deletions
            WHERE deleted_at > :since::timestamptz - ${OVERLAP}
          `,
          { since: input.since },
        )
      : { rows: [] };
    return {
      songs: rows.map((row) => toSongRecord(row, ctx.user)),
      removedIds: deleted.map((d) => Number(d.song_id)),
      cursor: (clock[0].now as Date).toISOString(),
    };
  });
