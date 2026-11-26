import { z } from 'zod';
import {
  idSchema,
  noteLineIndexSchema,
  noteLineTextSchema,
  noteTextSchema,
} from '#shared/validators/index.ts';
import { loadNote } from '../../notes/record.ts';
import { assertCanEdit } from '../../playlists/load.ts';
import { loadSongRow } from '../../songs/load.ts';
import { fail, verifiedProcedure } from '../../trpc/trpc.ts';

/**
 * A note on a song the author may read (D135): their own, for a playlist they may edit and the
 * song is in, or a report of a mistake for the songbook's editors (D143), on a song they
 * review: never a private one. At a line (its place among the song's lines and its words) or on
 * the whole song. A TODO is one's own only.
 */
export const create = verifiedProcedure
  .input(
    z
      .object({
        songId: idSchema,
        kind: z.enum(['own', 'playlist', 'report']),
        playlistId: idSchema.nullable(),
        text: noteTextSchema,
        todo: z.boolean(),
        line: z
          .object({ index: noteLineIndexSchema, text: noteLineTextSchema })
          .nullable(),
      })
      // A playlist's note names its playlist; no other note has one.
      .refine((input) => (input.kind === 'playlist') === (input.playlistId !== null)),
  )
  .mutation(async ({ ctx, input }) => {
    const song = await loadSongRow(ctx.db, input.songId, ctx.user);
    if (input.todo && input.kind !== 'own') {
      fail('BAD_REQUEST', 'NOTE_TODO_PRIVATE');
    }
    if (input.kind === 'report' && song.status === 'private') {
      fail('BAD_REQUEST', 'NOTE_REPORT_PRIVATE');
    }
    if (input.playlistId !== null) {
      const playlist = await assertCanEdit(ctx.db, input.playlistId, ctx.user);
      if (!playlist.songIds.includes(input.songId)) {
        fail('NOT_FOUND', 'NOT_FOUND');
      }
    }
    const { rows } = await ctx.db.raw(
      /* sql */ `
        INSERT INTO song_notes
          (song_id, kind, author_id, playlist_id, text, todo, line_index, line_text)
        VALUES
          (:songId, :kind, :authorId, :playlistId, :text, :todo, :lineIndex, :lineText)
        RETURNING id
      `,
      {
        songId: input.songId,
        kind: input.kind,
        authorId: ctx.user.id,
        playlistId: input.playlistId,
        text: input.text,
        todo: input.todo,
        lineIndex: input.line?.index ?? null,
        lineText: input.line?.text ?? null,
      },
    );
    return loadNote(ctx.db, Number(rows[0].id), ctx.user);
  });
