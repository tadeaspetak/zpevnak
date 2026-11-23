import { router } from '../../trpc/trpc.ts';
import { invite, resetInvite } from './sharing.invite.ts';
import { invitePreview } from './sharing.invitePreview.ts';
import { join } from './sharing.join.ts';
import {
  leave,
  members,
  removeMember,
  restoreMember,
  setRole,
} from './sharing.members.ts';

/** Sharing a playlist or a private song with people: one way for both (D126, D127). */
export const sharingRouter = router({
  invite,
  resetInvite,
  invitePreview,
  join,
  members,
  leave,
  removeMember,
  restoreMember,
  setRole,
});
