import type { Role } from '#shared/validators/index.ts';
import { adminProcedure } from '../../trpc/trpc.ts';

type UserRow = {
  id: number;
  email: string;
  display_name: string;
  role: Role;
  email_verified_at: Date | null;
  created_at: Date;
};

export const list = adminProcedure.query(async ({ ctx }) => {
  const { rows } = await ctx.db.raw<{ rows: UserRow[] }>(
    /* sql */ `
      SELECT id, email, display_name, role, email_verified_at, created_at
      FROM users
      -- The viewer first, then by rank, then by name; the id breaks ties between equal names,
      -- so the order is the same on every load. A changed role moves its row on purpose.
      ORDER BY id = :viewer DESC,
        CASE role WHEN 'admin' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
        display_name, id
    `,
    { viewer: ctx.user.id },
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    role: r.role,
    emailVerified: r.email_verified_at !== null,
    createdAt: r.created_at.toISOString(),
  }));
});
