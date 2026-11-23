import { z } from 'zod';
import {
  READABLE_PRIVATE_SONG_IDS,
  SONG_COLUMNS,
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
 * shared one, joining a playlist with one (D128), or no longer, doesn't change the song, so a
 * cursor would never notice. The device drops any private song not sent (D127). `removedIds` are public songs deleted since, or gone
 * private: the device drops them.
 */
export const sync = publicProcedure
  .input(z.object({ since: z.iso.datetime().nullable() }))
  .query(async ({ ctx, input }) => {
    const { rows: clock } = await ctx.db.raw(/* sql */ `SELECT now() AS now`);
    const bindings = { since: input.since, viewerId: ctx.user?.id ?? null };
    // Two reads, each starting where it is cheap: public songs by when they changed (an index
    // on updated_at; everything for a first sync), and the private songs this viewer may read,
    // from the viewer's side. Never one pass over every song for both.
    const { rows } = await ctx.db.raw<{ rows: SongRow[] }>(
      /* sql */ `
        SELECT ${SONG_COLUMNS} FROM songs s
        WHERE s.status <> 'private'
          ${input.since ? /* sql */ `AND s.updated_at > :since::timestamptz - ${OVERLAP}` : ''}
        UNION ALL
        SELECT ${SONG_COLUMNS} FROM songs s
        WHERE s.status = 'private' AND s.id IN (${READABLE_PRIVATE_SONG_IDS})
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
