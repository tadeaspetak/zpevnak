import type { Knex } from 'knex';
import { z } from 'zod';
import { idSchema } from '#shared/validators/index.ts';
import { loadSong, loadSongRow } from '../../songs/load.ts';
import { fail, verifiedProcedure } from '../../trpc/trpc.ts';

/**
 * What keeps a public song from going private: someone else's work on it (an edit, an approval
 * or a rejection: every version not the owner's), or a place in someone else's playlist. Only a
 * song nobody else has a stake in, one made public by mistake, may go back (D127).
 */
async function privateBlockers(db: Knex, songId: number, ownerId: number) {
  const { rows } = await db.raw(
    /* sql */ `
      SELECT
        EXISTS (
          SELECT 1 FROM song_versions v
          WHERE v.song_id = :songId AND v.saved_by IS DISTINCT FROM :ownerId
        ) AS edited_by_others,
        EXISTS (
          SELECT 1 FROM playlist_songs ps JOIN playlists p ON p.id = ps.playlist_id
          WHERE ps.song_id = :songId AND p.owner_id <> :ownerId
        ) AS in_others_playlists,
        -- Someone's report waiting for a fix: never on a private song (D143).
        EXISTS (
          SELECT 1 FROM song_notes n
          WHERE n.song_id = :songId AND n.kind = 'report' AND n.resolved_at IS NULL
            AND n.author_id <> :ownerId
        ) AS reported_by_others
    `,
    { songId, ownerId },
  );
  return {
    editedByOthers: rows[0].edited_by_others as boolean,
    inOthersPlaylists: rows[0].in_others_playlists as boolean,
    reportedByOthers: rows[0].reported_by_others as boolean,
  };
}

/** For the owner's sharing dialog: whether the public song may still go private, and if not, why. */
export const privateBlockersOf = verifiedProcedure
  .input(z.object({ id: idSchema }))
  .query(async ({ ctx, input }) => {
    const song = await loadSong(ctx.db, input.id, ctx.user);
    if (song.role !== 'owner') {
      fail('FORBIDDEN', 'FORBIDDEN');
    }
    return privateBlockers(ctx.db, input.id, ctx.user.id);
  });

/**
 * The owner makes their song private or public. Public is publishing: it goes to the editors as
 * pending, like a new song. Private, while nobody else has a stake in it (`privateBlockers`): it
 * leaves the songbook and every device that isn't allowed it (`song_withdrawals`).
 */
export const setVisibility = verifiedProcedure
  .input(z.object({ id: idSchema, isPrivate: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db.transaction(async (trx) => {
      const row = await loadSongRow(trx, input.id, ctx.user, { forUpdate: true });
      if (row.viewer_role !== 'owner') {
        fail('FORBIDDEN', 'FORBIDDEN');
      }
      if ((row.status === 'private') === input.isPrivate) {
        return;
      }
      if (!input.isPrivate) {
        await trx.raw(
          /* sql */ `UPDATE songs SET status = 'pending', updated_at = now() WHERE id = :id`,
          { id: input.id },
        );
        return;
      }
      const blockers = await privateBlockers(trx, input.id, ctx.user.id);
      if (blockers.editedByOthers) {
        fail('BAD_REQUEST', 'SONG_EDITED_BY_OTHERS');
      }
      if (blockers.inOthersPlaylists) {
        fail('BAD_REQUEST', 'SONG_IN_OTHERS_PLAYLISTS');
      }
      if (blockers.reportedByOthers) {
        fail('BAD_REQUEST', 'SONG_REPORTED_BY_OTHERS');
      }
      await trx.raw(
        /* sql */ `
          UPDATE songs
          SET status = 'private', rejection_reason = NULL, rejection_note = NULL,
              updated_at = now()
          WHERE id = :id
        `,
        { id: input.id },
      );
      await trx.raw(
        /* sql */ `
          INSERT INTO song_withdrawals (song_id) VALUES (:id)
          ON CONFLICT (song_id) DO UPDATE SET withdrawn_at = now()
        `,
        { id: input.id },
      );
    });
    return loadSong(ctx.db, input.id, ctx.user);
  });
