import { router } from '../../trpc/trpc.ts';
import { all } from './playlists.all.ts';
import { byId } from './playlists.byId.ts';
import { create } from './playlists.create.ts';
import { deletePlaylist } from './playlists.delete.ts';
import { edit } from './playlists.edit.ts';
import { invite, resetInvite } from './playlists.invite.ts';
import { invitePreview } from './playlists.invitePreview.ts';
import { join } from './playlists.join.ts';
import { leave, members, removeCollaborator } from './playlists.members.ts';
import { rename } from './playlists.rename.ts';
import { setPublic } from './playlists.setPublic.ts';

export const playlistsRouter = router({
  all,
  byId,
  create,
  edit,
  rename,
  setPublic,
  delete: deletePlaylist,
  invite,
  resetInvite,
  invitePreview,
  join,
  members,
  leave,
  removeCollaborator,
});
