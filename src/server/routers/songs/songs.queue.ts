import { z } from 'zod';
import type { RejectionReason } from '#shared/validators/index.ts';
import { editorProcedure } from '../../trpc/trpc.ts';

type QueueRow = {
  id: number;
  title: string;
  artist: string | null;
  created_at: Date;
  updated_at: Date;
  rejection_reason: RejectionReason | null;
  author_name: string | null;
  reviewer_name: string | null;
};

/** The editors' worklist: pending songs oldest first, or rejected ones newest first. */
export const queue = editorProcedure
  .input(z.object({ status: z.enum(['pending', 'rejected']) }))
  .query(async ({ ctx, input }) => {
    const { rows } = await ctx.db.raw<{ rows: QueueRow[] }>(
      /* sql */ `
        SELECT s.id, s.title, s.artist, s.created_at, s.updated_at, s.rejection_reason,
               author.display_name AS author_name, reviewer.display_name AS reviewer_name
        FROM songs s
        LEFT JOIN users author ON author.id = s.created_by
        LEFT JOIN users reviewer ON reviewer.id = s.reviewed_by
        WHERE s.status = :status
        ORDER BY ${input.status === 'pending' ? 's.created_at ASC' : 's.reviewed_at DESC'}
        LIMIT 500
      `,
      { status: input.status },
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      artist: r.artist,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
      rejectionReason: r.rejection_reason,
      authorName: r.author_name,
      reviewerName: r.reviewer_name,
    }));
  });
