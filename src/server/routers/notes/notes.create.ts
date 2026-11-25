import { z } from 'zod';
import {
  idSchema,
  noteLineTextSchema,
  noteTextSchema,
} from '#shared/validators/index.ts';
import { loadNote } from '../../notes/record.ts';
import { assertCanEdit } from '../../playlists/load.ts';
import { loadSongRow } from '../../songs/load.ts';
import { fail, verifiedProcedure } from '../../trpc/trpc.ts';

/**
 * A note on a song the author may read (D135): their own, or for a playlist they may edit and
 * the song is in. At a line (its place among the song's lines and its words) or on the whole
 * song. A TODO is one's own only.
 */
export const create = verifiedProcedure
  .input(
    z.object({
      songId: idSchema,
      playlistId: idSchema.nullable(),
      text: noteTextSchema,
      todo: z.boolean(),
      line: z
        .object({ index: z.number().int().min(0), text: noteLineTextSchema })
        .nullable(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await loadSongRow(ctx.db, input.songId, ctx.user);
    if (input.playlistId !== null) {
      if (input.todo) {
        fail('BAD_REQUEST', 'NOTE_TODO_PRIVATE');
      }
      const playlist = await assertCanEdit(ctx.db, input.playlistId, ctx.user);
      if (!playlist.songIds.includes(input.songId)) {
        fail('NOT_FOUND', 'NOT_FOUND');
      }
    }
    const { rows } = await ctx.db.raw(
      /* sql */ `
        INSERT INTO song_notes (song_id, author_id, playlist_id, text, todo, line_index, line_text)
        VALUES (:songId, :authorId, :playlistId, :text, :todo, :lineIndex, :lineText)
        RETURNING id
      `,
      {
        songId: input.songId,
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
