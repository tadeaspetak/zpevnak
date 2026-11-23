import { router } from '../../trpc/trpc.ts';
import { all } from './playlists.all.ts';
import { byId } from './playlists.byId.ts';
import { create } from './playlists.create.ts';
import { deletePlaylist } from './playlists.delete.ts';
import { edit } from './playlists.edit.ts';
import { rename } from './playlists.rename.ts';
import { setPublic } from './playlists.setPublic.ts';

// Sharing (invites, people, roles) is the sharing router's, for songs too.
export const playlistsRouter = router({
  all,
  byId,
  create,
  edit,
  rename,
  setPublic,
  delete: deletePlaylist,
});
