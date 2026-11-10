import { z } from 'zod';
import { applyOp } from '#shared/playlistOps.ts';
import { idSchema, PLAYLIST_MAX_SONGS } from '#shared/validators/index.ts';
import { assertMember, loadVisiblePlaylist } from '../../playlists/load.ts';
import { assertSongsUsable, writeSongs } from '../../playlists/writeSongs.ts';
import { fail, verifiedProcedure } from '../../trpc/trpc.ts';

const index = z.number().int().min(0).max(1000);
const opSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add'), songId: idSchema }),
  z.object({ type: z.literal('remove'), songId: idSchema, index }),
  z.object({ type: z.literal('move'), songId: idSchema, from: index, to: index }),
]);

/**
 * One change to the song order, by the owner or a collaborator, applied to the playlist as it
 * is now (`applyOp`): two people editing at once both keep their changes. The row lock makes
 * concurrent edits take turns.
 */
export const edit = verifiedProcedure
  .input(z.object({ id: idSchema, op: opSchema }))
  .mutation(async ({ ctx, input }) => {
    await assertMember(ctx.db, input.id, ctx.user);
    await ctx.db.transaction(async (trx) => {
      await trx.raw(/* sql */ `SELECT 1 FROM playlists WHERE id = :id FOR UPDATE`, {
        id: input.id,
      });
      const { rows } = await trx.raw<{ rows: { song_id: number }[] }>(
        /* sql */ `
          SELECT song_id FROM playlist_songs WHERE playlist_id = :id ORDER BY position
        `,
        { id: input.id },
      );
      if (input.op.type === 'add') {
        await assertSongsUsable(trx, [input.op.songId], ctx.user);
        if (rows.length >= PLAYLIST_MAX_SONGS) {
          fail('BAD_REQUEST', 'PLAYLIST_FULL');
        }
      }
      const next = applyOp(
        rows.map((r) => Number(r.song_id)),
        input.op,
      );
      await writeSongs(trx, input.id, next);
      await trx.raw(/* sql */ `UPDATE playlists SET updated_at = now() WHERE id = :id`, {
        id: input.id,
      });
    });
    return loadVisiblePlaylist(ctx.db, input.id, ctx.user);
  });
