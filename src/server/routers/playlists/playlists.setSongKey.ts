import { z } from 'zod';
import { idSchema } from '#shared/validators/index.ts';
import { assertCanEdit, loadVisiblePlaylist } from '../../playlists/load.ts';
import { fail, verifiedProcedure } from '../../trpc/trpc.ts';

/**
 * The key the playlist plays a song in (D131): `semitones` from the song's own text, which then
 * started from `from` (its pitch, `songPitch`; null for a song that names none), so a key later
 * saved for everyone keeps the playlist sounding the same. 0 plays it in the song's own key.
 * Whoever may edit the playlist sets it, under the lock every playlist edit takes (D69).
 */
export const setSongKey = verifiedProcedure
  .input(
    z.object({
      id: idSchema,
      songId: idSchema,
      semitones: z.number().int().min(-11).max(11),
      from: z.number().int().min(0).max(11).nullable(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.db.transaction(async (trx) => {
      await trx.raw(/* sql */ `SELECT 1 FROM playlists WHERE id = :id FOR UPDATE`, {
        id: input.id,
      });
      const playlist = await assertCanEdit(trx, input.id, ctx.user);
      // Only a song in it, and one the editor may read: the record lists no other.
      if (!playlist.songIds.includes(input.songId)) {
        fail('NOT_FOUND', 'NOT_FOUND');
      }
      if (input.semitones === 0) {
        await trx.raw(
          /* sql */ `
            DELETE FROM playlist_song_keys WHERE playlist_id = :id AND song_id = :songId
          `,
          input,
        );
      } else {
        await trx.raw(
          /* sql */ `
            INSERT INTO playlist_song_keys (playlist_id, song_id, semitones, from_pitch)
            VALUES (:id, :songId, :semitones, :from)
            ON CONFLICT (playlist_id, song_id)
              DO UPDATE SET semitones = excluded.semitones, from_pitch = excluded.from_pitch
          `,
          input,
        );
      }
      await trx.raw(/* sql */ `UPDATE playlists SET updated_at = now() WHERE id = :id`, {
        id: input.id,
      });
    });
    return loadVisiblePlaylist(ctx.db, input.id, ctx.user);
  });
