import { z } from 'zod';
import { idSchema, seenAtSchema, songSourceSchema } from '#shared/validators/index.ts';
import { readHeader } from '../../songs/header.ts';
import { assertUnchanged, loadSongRow, loadSong } from '../../songs/load.ts';
import { recordVersion } from '../../songs/versions.ts';
import { editorProcedure } from '../../trpc/trpc.ts';

/**
 * Marks the song verified, saving the editor's last edits with it when `source` is given. Every
 * approval is a version, edited or not: it pins the exact text that was approved, and by whom
 * (D86).
 */
export const verify = editorProcedure
  .input(
    z.object({
      id: idSchema,
      source: songSourceSchema.optional(),
      seenAt: seenAtSchema,
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.db.transaction(async (trx) => {
      // Locked, and read inside: approving "as it is" approves the text as it is now, not as it
      // was before an author's save that landed in between.
      const row = await loadSongRow(trx, input.id, { forUpdate: true });
      // And only the text the editor read: not one an author's save replaced meanwhile.
      assertUnchanged(row, input.seenAt);
      const source = input.source ?? row.source;
      const { title, artist } = readHeader(source);
      await trx.raw(
        /* sql */ `
          UPDATE songs
          SET source = :source, title = :title, artist = :artist,
              status = 'verified', rejection_reason = NULL, rejection_note = NULL,
              reviewed_by = :userId, reviewed_at = now(), updated_at = now()
          WHERE id = :id
        `,
        { id: input.id, source, title, artist, userId: ctx.user.id },
      );
      await recordVersion(trx, input.id, 'approve', ctx.user.id);
    });
    return loadSong(ctx.db, input.id, ctx.user);
  });
