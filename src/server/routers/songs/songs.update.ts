import { z } from 'zod';
import { canChangeSong } from '#shared/songs.ts';
import { idSchema, seenAtSchema, songSourceSchema } from '#shared/validators/index.ts';
import { readHeader } from '../../songs/header.ts';
import { assertUnchanged, loadSongRow, loadSong } from '../../songs/load.ts';
import { recordVersion } from '../../songs/versions.ts';
import { fail, verifiedProcedure } from '../../trpc/trpc.ts';

/**
 * Editors edit any song; an author their own song while it is pending or rejected (D78). An
 * edit keeps a verified or pending song's status, but a rejected song, once its text changes,
 * goes back for review as pending, whoever changed it: the rejection was of the old text (D81).
 * Saved unchanged, it stays rejected.
 *
 * A save that changes the text is a version (D86); one that doesn't changes nothing worth
 * keeping, and would credit someone who only opened and saved.
 */
export const update = verifiedProcedure
  .input(z.object({ id: idSchema, source: songSourceSchema, seenAt: seenAtSchema }))
  .mutation(async ({ ctx, input }) => {
    const { title, artist } = readHeader(input.source);
    await ctx.db.transaction(async (trx) => {
      // Locked: an editor approving it meanwhile is seen here, not overwritten.
      const row = await loadSongRow(trx, input.id, { forUpdate: true });
      const song = { status: row.status, createdBy: row.created_by };
      if (!canChangeSong(ctx.user, song)) {
        fail(
          'FORBIDDEN',
          row.created_by === ctx.user.id ? 'SONG_NOT_EDITABLE' : 'FORBIDDEN',
        );
      }
      assertUnchanged(row, input.seenAt);
      const changed = input.source !== row.source;
      const resubmit = row.status === 'rejected' && changed;
      await trx.raw(
        /* sql */ `
          UPDATE songs
          SET source = :source, title = :title, artist = :artist, updated_at = now()
              ${resubmit ? /* sql */ `, status = 'pending', rejection_reason = NULL, rejection_note = NULL` : ''}
          WHERE id = :id
        `,
        { id: input.id, source: input.source, title, artist },
      );
      if (changed) {
        await recordVersion(trx, input.id, 'edit', ctx.user.id);
      }
    });
    return loadSong(ctx.db, input.id, ctx.user);
  });
