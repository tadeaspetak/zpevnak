import type { Knex } from 'knex';
import { z } from 'zod';
import { idSchema } from '#shared/validators/index.ts';
import type { SessionUser } from '../../auth/sessions.ts';
import { loadSongRow } from '../../songs/load.ts';
import { isEditor } from '../../songs/record.ts';
import { fail, verifiedProcedure } from '../../trpc/trpc.ts';

/**
 * Editors delete any song; an author their own until it is approved (an approved song belongs
 * to the songbook). D78.
 */
async function assertCanDelete(db: Knex, id: number, user: SessionUser) {
  const row = await loadSongRow(db, id);
  if (!isEditor(user) && !(row.created_by === user.id && row.status !== 'verified')) {
    fail('FORBIDDEN', 'FORBIDDEN');
  }
}

/** How many playlists would lose the song: the confirmation says so before anything goes. */
export const deleteImpact = verifiedProcedure
  .input(z.object({ id: idSchema }))
  .query(async ({ ctx, input }) => {
    await assertCanDelete(ctx.db, input.id, ctx.user);
    const { rows } = await ctx.db.raw(
      /* sql */ `
        SELECT count(DISTINCT playlist_id)::int AS playlists
        FROM playlist_songs WHERE song_id = :id
      `,
      { id: input.id },
    );
    return { playlists: rows[0].playlists as number };
  });

/**
 * Deletes the song for good: its row, its place in every playlist, and, through
 * `song_deletions`, every device's copy on the next sync. The one change to people's playlists
 * that isn't theirs (D78), so it is a deliberate act with its own confirmation.
 */
export const deleteSong = verifiedProcedure
  .input(z.object({ id: idSchema }))
  .mutation(async ({ ctx, input }) => {
    await assertCanDelete(ctx.db, input.id, ctx.user);
    await ctx.db.transaction(async (trx) => {
      // Playlists lose it from their song lists: they changed, and their devices should know.
      await trx.raw(
        /* sql */ `
          UPDATE playlists SET updated_at = now()
          WHERE id IN (SELECT playlist_id FROM playlist_songs WHERE song_id = :id)
        `,
        { id: input.id },
      );
      await trx.raw(/* sql */ `DELETE FROM songs WHERE id = :id`, { id: input.id });
      await trx.raw(
        /* sql */ `
          INSERT INTO song_deletions (song_id) VALUES (:id)
          ON CONFLICT (song_id) DO UPDATE SET deleted_at = now()
        `,
        { id: input.id },
      );
    });
    return { ok: true };
  });
