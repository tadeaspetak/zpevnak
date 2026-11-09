import { z } from 'zod';
import {
  inCatalog,
  SONG_COLUMNS,
  toSongRecord,
  type SongRow,
} from '../../songs/record.ts';
import { publicProcedure } from '../../trpc/trpc.ts';

// Rows committed by a transaction that started before the previous cursor can carry an
// earlier updated_at. Re-reading a minute back catches them; the client merges by id.
const OVERLAP = "interval '1 minute'";

/**
 * Everything in the viewer's catalog that changed since `since` (an earlier response's
 * cursor), or the whole catalog for null. `removedIds` are songs that left it: the device
 * drops them.
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
    const songs = [];
    const removedIds = [];
    for (const row of rows) {
      if (inCatalog(row, ctx.user)) {
        songs.push(toSongRecord(row, ctx.user));
      } else if (input.since) {
        removedIds.push(row.id);
      }
    }
    return { songs, removedIds, cursor: (clock[0].now as Date).toISOString() };
  });
