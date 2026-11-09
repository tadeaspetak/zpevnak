import { notifications } from '@mantine/notifications';
import { applyOp, type PlaylistOp } from '#shared/playlistOps.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { putPlaylist, syncCatalog, useCatalog } from './catalog.ts';
import type { PlaylistRecord } from './store.ts';

/**
 * Changes to one playlist. A change to the songs shows on this device at once, applied with
 * the same `applyOp` the server uses, then saves; the server's answer replaces the guess. On
 * an error the device takes the server's word again.
 */
export function usePlaylistEdits(playlistId: number) {
  const { tError } = useI18n();
  const { me } = useMe();
  const { playlists } = useCatalog();
  const handlers = {
    onSuccess: (playlist: PlaylistRecord) => putPlaylist(playlist.id, playlist),
    onError: (error: unknown) => {
      notifications.show({ color: 'red', message: tError(error) });
      void syncCatalog(me?.id ?? null);
    },
  };
  const editMutation = trpc.playlists.edit.useMutation(handlers);
  const renameMutation = trpc.playlists.rename.useMutation(handlers);
  const publicMutation = trpc.playlists.setPublic.useMutation(handlers);

  return {
    edit: (op: PlaylistOp) => {
      const playlist = playlists.get(playlistId);
      if (playlist) {
        putPlaylist(playlistId, { ...playlist, songIds: applyOp(playlist.songIds, op) });
      }
      editMutation.mutate({ id: playlistId, op });
    },
    rename: (name: string) => renameMutation.mutate({ id: playlistId, name }),
    setPublic: (isPublic: boolean) => publicMutation.mutate({ id: playlistId, isPublic }),
  };
}
