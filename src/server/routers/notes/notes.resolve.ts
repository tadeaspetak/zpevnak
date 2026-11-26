import { z } from 'zod';
import { canChangeSong } from '#shared/songs.ts';
import { idSchema } from '#shared/validators/index.ts';
import { findNote, loadNote } from '../../notes/record.ts';
import { loadSongRow } from '../../songs/load.ts';
import { fail, verifiedProcedure } from '../../trpc/trpc.ts';

/**
 * A report of a mistake, fixed (D143): by whoever may fix it, that is change the song (an
 * editor; its author while it isn't approved). It leaves the song and the queue, and stays with
 * whoever reported it, marked resolved: returned to them, null to anyone else.
 */
export const resolve = verifiedProcedure
  .input(z.object({ id: idSchema }))
  .mutation(async ({ ctx, input }) => {
    const note = await loadNote(ctx.db, input.id, ctx.user);
    if (note.kind !== 'report') {
      fail('FORBIDDEN', 'FORBIDDEN');
    }
    if (note.resolvedAt !== null) {
      fail('BAD_REQUEST', 'NOTE_RESOLVED');
    }
    const song = await loadSongRow(ctx.db, note.songId, ctx.user);
    if (
      !canChangeSong(ctx.user, {
        status: song.status,
        createdBy: song.created_by,
        role: song.viewer_role,
      })
    ) {
      fail('FORBIDDEN', 'FORBIDDEN');
    }
    // Resolved once: two editors at once leave the first one's name.
    await ctx.db.raw(
      /* sql */ `
        UPDATE song_notes SET resolved_at = now(), resolved_by = :userId
        WHERE id = :id AND resolved_at IS NULL
      `,
      { id: input.id, userId: ctx.user.id },
    );
    // Its reporter keeps it, resolved; anyone else no longer sees it (null).
    return { note: await findNote(ctx.db, input.id, ctx.user) };
  });
