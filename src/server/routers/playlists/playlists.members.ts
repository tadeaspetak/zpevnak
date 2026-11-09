import { z } from 'zod';
import { idSchema } from '#shared/validators/index.ts';
import { assertMember, assertOwner, type PlaylistRole } from '../../playlists/load.ts';
import { fail, verifiedProcedure } from '../../trpc/trpc.ts';

type MemberRow = { id: number; display_name: string; role: PlaylistRole };

/** Who is in the playlist: the owner first, then collaborators by when they joined. */
export const members = verifiedProcedure
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
export const leave = verifiedProcedure
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

/** The owner takes someone out of the playlist. */
export const removeCollaborator = verifiedProcedure
  .input(z.object({ id: idSchema, userId: idSchema }))
  .mutation(async ({ ctx, input }) => {
    await assertOwner(ctx.db, input.id, ctx.user);
    await ctx.db.raw(
      /* sql */ `
        DELETE FROM playlist_collaborators WHERE playlist_id = :id AND user_id = :userId
      `,
      input,
    );
    return { ok: true };
  });
