import { z } from 'zod';
import { applyOpAround } from '#shared/playlistOps.ts';
import { idSchema } from '#shared/validators/index.ts';
import { assertMember, loadVisiblePlaylist } from '../../playlists/load.ts';
import { assertSongsUsable, writeSongs } from '../../playlists/writeSongs.ts';
import { inCatalog, type SongRow } from '../../songs/record.ts';
import { fail, verifiedProcedure } from '../../trpc/trpc.ts';

const index = z.number().int().min(0).max(1000);
const opSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add'), songId: idSchema }),
  z.object({ type: z.literal('remove'), songId: idSchema, index }),
  z.object({ type: z.literal('move'), songId: idSchema, from: index, to: index }),
]);

const MAX_SONGS = 500;

/**
 * One change to the song order, by the owner or a collaborator, applied to the playlist as it
 * is now (`applyOp`): two people editing at once both keep their changes. The row lock makes
 * concurrent edits take turns. Songs hidden from the editor keep their place (D76).
 */
export const edit = verifiedProcedure
  .input(z.object({ id: idSchema, op: opSchema }))
  .mutation(async ({ ctx, input }) => {
    await assertMember(ctx.db, input.id, ctx.user);
    await ctx.db.transaction(async (trx) => {
      await trx.raw(/* sql */ `SELECT 1 FROM playlists WHERE id = :id FOR UPDATE`, {
        id: input.id,
      });
      const { rows } = await trx.raw<{
        rows: ({ song_id: number } & Pick<SongRow, 'status' | 'created_by'>)[];
      }>(
        /* sql */ `
          SELECT ps.song_id, s.status, s.created_by
          FROM playlist_songs ps JOIN songs s ON s.id = ps.song_id
          WHERE ps.playlist_id = :id
          ORDER BY ps.position
        `,
        { id: input.id },
      );
      if (input.op.type === 'add') {
        await assertSongsUsable(trx, [input.op.songId], ctx.user);
        if (rows.length >= MAX_SONGS) {
          fail('BAD_REQUEST', 'FORBIDDEN');
        }
      }
      // The editor saw the playlist without the songs hidden from them (D76): apply the edit
      // to that view, and keep the hidden songs where they were.
      const hiddenFromEditor = new Set(
        rows.filter((r) => !inCatalog(r, ctx.user)).map((r) => Number(r.song_id)),
      );
      const next = applyOpAround(
        rows.map((r) => Number(r.song_id)),
        (songId) => !hiddenFromEditor.has(songId),
        input.op,
      );
      await writeSongs(trx, input.id, next);
      await trx.raw(/* sql */ `UPDATE playlists SET updated_at = now() WHERE id = :id`, {
        id: input.id,
      });
    });
    return loadVisiblePlaylist(ctx.db, input.id, ctx.user);
  });
