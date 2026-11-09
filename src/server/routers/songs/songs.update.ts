import { z } from 'zod';
import { idSchema, songSourceSchema } from '#shared/validators/index.ts';
import { readHeader } from '../../songs/header.ts';
import { loadSongRow, loadVisibleSong } from '../../songs/load.ts';
import { canSeeSong, isEditor } from '../../songs/record.ts';
import { fail, verifiedProcedure } from '../../trpc/trpc.ts';

/**
 * Editors edit any song, and the song keeps its status. An author edits their own song only
 * while it is pending or rejected; editing a rejected song resubmits it as pending.
 */
export const update = verifiedProcedure
  .input(z.object({ id: idSchema, source: songSourceSchema }))
  .mutation(async ({ ctx, input }) => {
    const row = await loadSongRow(ctx.db, input.id);
    if (!canSeeSong(row, ctx.user)) {
      fail('NOT_FOUND', 'NOT_FOUND');
    }
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
    const resubmit = !editor && row.status === 'rejected';
    await ctx.db.raw(
      /* sql */ `
        UPDATE songs
        SET source = :source, title = :title, artist = :artist, updated_at = now()
            ${resubmit ? /* sql */ `, status = 'pending', rejection_reason = NULL, rejection_note = NULL` : ''}
        WHERE id = :id
      `,
      { id: input.id, source: input.source, title, artist },
    );
    return loadVisibleSong(ctx.db, input.id, ctx.user);
  });
