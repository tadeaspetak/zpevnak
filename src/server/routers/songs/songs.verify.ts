import { z } from 'zod';
import { idSchema, songSourceSchema } from '#shared/validators/index.ts';
import { readHeader } from '../../songs/header.ts';
import { loadSongRow, loadVisibleSong } from '../../songs/load.ts';
import { editorProcedure } from '../../trpc/trpc.ts';

/** Marks the song verified, saving the editor's last edits with it when `source` is given. */
export const verify = editorProcedure
  .input(z.object({ id: idSchema, source: songSourceSchema.optional() }))
  .mutation(async ({ ctx, input }) => {
    const row = await loadSongRow(ctx.db, input.id);
    const source = input.source ?? row.source;
    const { title, artist } = readHeader(source);
    await ctx.db.raw(
      /* sql */ `
        UPDATE songs
        SET source = :source, title = :title, artist = :artist,
            status = 'verified', rejection_reason = NULL, rejection_note = NULL,
            reviewed_by = :userId, reviewed_at = now(), updated_at = now()
        WHERE id = :id
      `,
      { id: input.id, source, title, artist, userId: ctx.user.id },
    );
    return loadVisibleSong(ctx.db, input.id, ctx.user);
  });
