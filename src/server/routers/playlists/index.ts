import { router } from '../../trpc/trpc.ts';
import { all } from './playlists.all.ts';
import { byId } from './playlists.byId.ts';
import { create } from './playlists.create.ts';
import { deletePlaylist } from './playlists.delete.ts';
import { update } from './playlists.update.ts';

export const playlistsRouter = router({
  all,
  byId,
  create,
  update,
  delete: deletePlaylist,
});
