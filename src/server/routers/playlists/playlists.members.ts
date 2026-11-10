import { z } from 'zod';
import { idSchema } from '#shared/validators/index.ts';
import {
  assertMember,
  assertOwner,
  loadVisiblePlaylist,
  type PlaylistRole,
} from '../../playlists/load.ts';
import { authedProcedure, fail, verifiedProcedure } from '../../trpc/trpc.ts';

type MemberRow = { id: number; display_name: string; role: PlaylistRole };

/** Who is in the playlist: the owner first, then collaborators by when they joined. */
// Members and leaving need only an account, like joining (an unconfirmed account can join).
export const members = authedProcedure
  .input(z.object({ id: idSchema }))
  .query(async ({ ctx, input }) => {
    await assertMember(ctx.db, input.id, ctx.user);
    const { rows } = await ctx.db.raw<{ rows: MemberRow[] }>(
      /* sql */ `
        SELECT u.id, u.display_name, 'owner' AS role, NULL::timestamptz AS joined_at
        FROM playlists p JOIN users u ON u.id = p.owner_id
        WHERE p.id = :id
        UNION ALL
        SELECT u.id, u.display_name, 'collaborator', c.joined_at
        FROM playlist_collaborators c JOIN users u ON u.id = c.user_id
        WHERE c.playlist_id = :id
        ORDER BY joined_at NULLS FIRST
      `,
      { id: input.id },
    );
    return rows.map((r) => ({ id: r.id, displayName: r.display_name, role: r.role }));
  });

/** A collaborator leaves; the owner can't (they delete the playlist instead). */
export const leave = authedProcedure
  .input(z.object({ id: idSchema }))
  .mutation(async ({ ctx, input }) => {
    const playlist = await assertMember(ctx.db, input.id, ctx.user);
    if (playlist.role !== 'collaborator') {
      fail('BAD_REQUEST', 'FORBIDDEN');
    }
    await ctx.db.raw(
      /* sql */ `
        DELETE FROM playlist_collaborators WHERE playlist_id = :id AND user_id = :userId
      `,
      { id: input.id, userId: ctx.user.id },
    );
    return { ok: true };
  });

/**
 * The owner takes someone out of the playlist, at once and with one tap; the removal is kept so
 * it can be undone (`restoreCollaborator`, D87).
 */
export const removeCollaborator = verifiedProcedure
  .input(z.object({ id: idSchema, userId: idSchema }))
  .mutation(async ({ ctx, input }) => {
    await assertOwner(ctx.db, input.id, ctx.user);
    await ctx.db.raw(
      /* sql */ `
        WITH removed AS (
          DELETE FROM playlist_collaborators WHERE playlist_id = :id AND user_id = :userId
          RETURNING playlist_id, user_id, joined_at
        )
        INSERT INTO playlist_collaborator_removals (playlist_id, user_id, joined_at)
        SELECT playlist_id, user_id, joined_at FROM removed
      `,
      input,
    );
    return loadVisiblePlaylist(ctx.db, input.id, ctx.user);
  });

/**
 * How long a removal can be undone. The undo lives in a toast that closes after seconds; the
 * window is wider so a slow connection doesn't lose it, and narrow enough that it stays an undo
 * rather than a way to pull someone back in weeks later.
 */
const UNDO_MINUTES = 10;

/**
 * Undoes the owner's recent removal: the person is back, as they were, with their original
 * join date. Only someone this owner removed from this playlist moments ago: an owner can't
 * use it to add anyone else.
 */
export const restoreCollaborator = verifiedProcedure
  .input(z.object({ id: idSchema, userId: idSchema }))
  .mutation(async ({ ctx, input }) => {
    await assertOwner(ctx.db, input.id, ctx.user);
    await ctx.db.transaction(async (trx) => {
      const { rows } = await trx.raw(
        /* sql */ `
          SELECT id, joined_at FROM playlist_collaborator_removals
          WHERE playlist_id = :id AND user_id = :userId AND restored_at IS NULL
            AND removed_at > now() - make_interval(mins => :undoMinutes)
          ORDER BY removed_at DESC
          LIMIT 1
          FOR UPDATE
        `,
        { ...input, undoMinutes: UNDO_MINUTES },
      );
      const removal = rows[0];
      if (!removal) {
        fail('BAD_REQUEST', 'UNDO_EXPIRED');
      }
      // They may have come back through the invite link meanwhile: then they are in already.
      await trx.raw(
        /* sql */ `
          INSERT INTO playlist_collaborators (playlist_id, user_id, joined_at)
          VALUES (:id, :userId, :joinedAt)
          ON CONFLICT (playlist_id, user_id) DO NOTHING
        `,
        { ...input, joinedAt: removal.joined_at },
      );
      await trx.raw(
        /* sql */ `
          UPDATE playlist_collaborator_removals SET restored_at = now() WHERE id = :removalId
        `,
        { removalId: removal.id },
      );
    });
    return loadVisiblePlaylist(ctx.db, input.id, ctx.user);
  });
