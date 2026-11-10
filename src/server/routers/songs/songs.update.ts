import { z } from 'zod';
import { idSchema, songSourceSchema } from '#shared/validators/index.ts';
import { readHeader } from '../../songs/header.ts';
import { loadSongRow, loadSong } from '../../songs/load.ts';
import { isEditor } from '../../songs/record.ts';
import { recordVersion } from '../../songs/versions.ts';
import { fail, verifiedProcedure } from '../../trpc/trpc.ts';

/**
 * Editors edit any song; an author their own song while it is pending or rejected. An edit keeps
 * a verified or pending song's status, but a rejected song, once changed, goes back for review
 * as pending, whoever changed it: the rejection was of the old text (D81).
 *
 * A save that changes the text is a version (D86); one that doesn't changes nothing worth
 * keeping, and would credit someone who only opened and saved.
 */
export const update = verifiedProcedure
  .input(z.object({ id: idSchema, source: songSourceSchema }))
  .mutation(async ({ ctx, input }) => {
    const row = await loadSongRow(ctx.db, input.id);
    const editor = isEditor(ctx.user);
    if (!editor) {
      if (row.created_by !== ctx.user.id) {
        fail('FORBIDDEN', 'FORBIDDEN');
      }
      if (row.status === 'verified') {
        fail('FORBIDDEN', 'SONG_NOT_EDITABLE');
      }
    }
    const { title, artist } = readHeader(input.source);
    const resubmit = row.status === 'rejected';
    await ctx.db.transaction(async (trx) => {
      await trx.raw(
        /* sql */ `
          UPDATE songs
          SET source = :source, title = :title, artist = :artist, updated_at = now()
              ${resubmit ? /* sql */ `, status = 'pending', rejection_reason = NULL, rejection_note = NULL` : ''}
          WHERE id = :id
        `,
        { id: input.id, source: input.source, title, artist },
      );
      if (input.source !== row.source) {
        await recordVersion(trx, input.id, 'edit', ctx.user.id);
      }
    });
    return loadSong(ctx.db, input.id, ctx.user);
  });
