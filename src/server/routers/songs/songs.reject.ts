import { z } from 'zod';
import {
  idSchema,
  rejectionReasonSchema,
  seenAtSchema,
} from '#shared/validators/index.ts';
import type { Locale } from '#shared/validators/index.ts';
import { sendEmailInBackground } from '../../email/send.ts';
import { songRejected } from '../../email/templates.ts';
import { assertUnchanged, loadSongRow, loadSong } from '../../songs/load.ts';
import { recordVersion } from '../../songs/versions.ts';
import { editorProcedure, fail } from '../../trpc/trpc.ts';

/**
 * An editor turns a song down, with a reason. "Other" says nothing by itself, so it needs a
 * note. The rejection is kept in the song's history (D86), and its author hears about it by
 * email, unless they rejected it themselves.
 */
export const reject = editorProcedure
  .input(
    z.object({
      id: idSchema,
      reason: rejectionReasonSchema,
      note: z.string().trim().max(1000).optional(),
      seenAt: seenAtSchema,
    }),
  )
  .mutation(async ({ ctx, input }) => {
    if (input.reason === 'other' && !input.note) {
      fail('BAD_REQUEST', 'REJECTION_NOTE_REQUIRED');
    }
    const row = await ctx.db.transaction(async (trx) => {
      // Locked, and only the text the editor read: not a fix the author saved meanwhile.
      const locked = await loadSongRow(trx, input.id, { forUpdate: true });
      assertUnchanged(locked, input.seenAt);
      await trx.raw(
        /* sql */ `
          UPDATE songs
          SET status = 'rejected', rejection_reason = :reason, rejection_note = :note,
              reviewed_by = :userId, reviewed_at = now(), updated_at = now()
          WHERE id = :id
        `,
        {
          id: input.id,
          reason: input.reason,
          note: input.note || null,
          userId: ctx.user.id,
        },
      );
      await recordVersion(trx, input.id, 'reject', ctx.user.id);
      return locked;
    });
    const song = await loadSong(ctx.db, input.id, ctx.user);

    if (row.created_by !== null && row.created_by !== ctx.user.id) {
      const { rows } = await ctx.db.raw<{ rows: { email: string; locale: Locale }[] }>(
        /* sql */ `SELECT email, locale FROM users WHERE id = :id`,
        { id: row.created_by },
      );
      const author = rows[0];
      if (author) {
        sendEmailInBackground(
          songRejected(author.email, author.locale, {
            id: song.id,
            title: song.title,
            reason: input.reason,
            note: input.note || null,
          }),
          'song rejected',
        );
      }
    }
    return song;
  });
