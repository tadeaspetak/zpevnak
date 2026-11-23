import { z } from 'zod';
import type { MemberRole } from '#shared/roles.ts';
import { idSchema, joinRoleSchema, sharedKindSchema } from '#shared/validators/index.ts';
import { assertMemberOf, assertOwnerOf, loadShared } from '../../sharing/access.ts';
import { SHARED_TABLES } from '../../sharing/tables.ts';
import { authedProcedure, fail, verifiedProcedure } from '../../trpc/trpc.ts';

const thing = z.object({ kind: sharedKindSchema, id: idSchema });
const person = thing.extend({ userId: idSchema });

type MemberRow = { id: number; display_name: string; role: MemberRole };

/** Who is in it and as what: the owner first, then the others by when they joined. */
// Members and leaving need only an account, like joining (an unconfirmed account can join).
export const members = authedProcedure.input(thing).query(async ({ ctx, input }) => {
  await assertMemberOf(ctx.db, input.kind, input.id, ctx.user);
  const { things, owner, members, key } = SHARED_TABLES[input.kind];
  const { rows } = await ctx.db.raw<{ rows: MemberRow[] }>(
    /* sql */ `
      SELECT u.id, u.display_name, 'owner' AS role, NULL::timestamptz AS joined_at
      FROM ${things} t JOIN users u ON u.id = t.${owner}
      WHERE t.id = :id
      UNION ALL
      SELECT u.id, u.display_name, m.role, m.joined_at
      FROM ${members} m JOIN users u ON u.id = m.user_id
      WHERE m.${key} = :id
      ORDER BY joined_at NULLS FIRST
    `,
    { id: input.id },
  );
  return rows.map((r) => ({ id: r.id, displayName: r.display_name, role: r.role }));
});

/** Anyone who joined leaves, a reader too; the owner can't (they delete it instead). */
export const leave = authedProcedure.input(thing).mutation(async ({ ctx, input }) => {
  const shared = await assertMemberOf(ctx.db, input.kind, input.id, ctx.user);
  if (shared.role === 'owner') {
    fail('BAD_REQUEST', 'FORBIDDEN');
  }
  const { members, key } = SHARED_TABLES[input.kind];
  await ctx.db.raw(
    /* sql */ `DELETE FROM ${members} WHERE ${key} = :id AND user_id = :userId`,
    { id: input.id, userId: ctx.user.id },
  );
  return { ok: true };
});

/**
 * The owner takes someone out, at once and with one tap; the removal is kept so it can be
 * undone (`restoreMember`, D87).
 */
export const removeMember = verifiedProcedure
  .input(person)
  .mutation(async ({ ctx, input }) => {
    await assertOwnerOf(ctx.db, input.kind, input.id, ctx.user);
    const { members, removals, key } = SHARED_TABLES[input.kind];
    await ctx.db.raw(
      /* sql */ `
        WITH removed AS (
          DELETE FROM ${members} WHERE ${key} = :id AND user_id = :userId
          RETURNING ${key}, user_id, joined_at, role
        )
        INSERT INTO ${removals} (${key}, user_id, joined_at, role)
        SELECT ${key}, user_id, joined_at, role FROM removed
      `,
      { id: input.id, userId: input.userId },
    );
    return loadShared(ctx.db, input.kind, input.id, ctx.user);
  });

/**
 * How long a removal can be undone. The undo lives in a toast that closes after seconds; the
 * window is wider so a slow connection doesn't lose it, and narrow enough that it stays an undo
 * rather than a way to pull someone back in weeks later.
 */
const UNDO_MINUTES = 10;

/**
 * Undoes the owner's recent removal: the person is back as they were, in their role and with
 * their original join date. Only someone this owner removed from this thing moments ago: an
 * owner can't use it to add anyone else.
 */
export const restoreMember = verifiedProcedure
  .input(person)
  .mutation(async ({ ctx, input }) => {
    await assertOwnerOf(ctx.db, input.kind, input.id, ctx.user);
    const { members, removals, key } = SHARED_TABLES[input.kind];
    await ctx.db.transaction(async (trx) => {
      const { rows } = await trx.raw(
        /* sql */ `
          SELECT id, joined_at, role FROM ${removals}
          WHERE ${key} = :id AND user_id = :userId AND restored_at IS NULL
            AND removed_at > now() - make_interval(mins => :undoMinutes)
          ORDER BY removed_at DESC
          LIMIT 1
          FOR UPDATE
        `,
        { id: input.id, userId: input.userId, undoMinutes: UNDO_MINUTES },
      );
      const removal = rows[0];
      if (!removal) {
        fail('BAD_REQUEST', 'UNDO_EXPIRED');
      }
      // They may have come back through the invite link meanwhile: then they are in already.
      await trx.raw(
        /* sql */ `
          INSERT INTO ${members} (${key}, user_id, joined_at, role)
          VALUES (:id, :userId, :joinedAt, :role)
          ON CONFLICT (${key}, user_id) DO NOTHING
        `,
        {
          id: input.id,
          userId: input.userId,
          joinedAt: removal.joined_at,
          role: removal.role,
        },
      );
      await trx.raw(
        /* sql */ `UPDATE ${removals} SET restored_at = now() WHERE id = :removalId`,
        { removalId: removal.id },
      );
    });
    return loadShared(ctx.db, input.kind, input.id, ctx.user);
  });

/** The owner lets someone edit, or makes them a reader. Only someone already in it. */
export const setRole = verifiedProcedure
  .input(person.extend({ role: joinRoleSchema }))
  .mutation(async ({ ctx, input }) => {
    await assertOwnerOf(ctx.db, input.kind, input.id, ctx.user);
    const { members, key } = SHARED_TABLES[input.kind];
    const { rowCount } = await ctx.db.raw(
      /* sql */ `
        UPDATE ${members} SET role = :role WHERE ${key} = :id AND user_id = :userId
      `,
      { id: input.id, userId: input.userId, role: input.role },
    );
    if (!rowCount) {
      fail('NOT_FOUND', 'NOT_FOUND');
    }
    return { ok: true };
  });
