import { useEffect } from 'react';
import { useOnline } from '../hooks/useOnline.ts';
import { trpc } from '../trpc.ts';
import { putPlaylist } from './catalog.ts';

/**
 * Loads a playlist fresh once, when its page opens, to show what others changed since the
 * device last synced. No timer and no refetch on returning to the app: polling cost requests
 * for nothing most of the time and was too slow for editing together (D72). A playlist the
 * viewer may no longer see (deleted, made private, or they were taken out) leaves the device.
 * `pending` while that load is on its way.
 */
export function useFreshPlaylist(id: number | null) {
  const online = useOnline();
  const query = trpc.playlists.byId.useQuery(
    { id: id ?? 0 },
    {
      enabled: id !== null && id > 0 && online,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 0,
      gcTime: 0,
      retry: false,
    },
  );
  useEffect(() => {
    if (query.data) {
      putPlaylist(query.data.id, query.data);
    }
  }, [query.data]);
  useEffect(() => {
    if (id && query.error?.message === 'NOT_FOUND') {
      putPlaylist(id, null);
    }
  }, [id, query.error]);
  return { pending: query.isLoading };
}
