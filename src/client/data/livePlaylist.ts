import { useEffect } from 'react';
import { useOnline } from '../hooks/useOnline.ts';
import { trpc } from '../trpc.ts';
import { putPlaylist } from './catalog.ts';

const REFRESH_MS = 30_000;

/**
 * Keeps an open playlist in step with what others change in it: every 30 seconds while
 * online, and on coming back to the app. A playlist the viewer may no longer see (deleted,
 * made private, or they were taken out) leaves the device.
 */
export function useLivePlaylist(id: number | null) {
  const online = useOnline();
  const query = trpc.playlists.byId.useQuery(
    { id: id ?? 0 },
    {
      enabled: id !== null && id > 0 && online,
      refetchInterval: REFRESH_MS,
      refetchOnWindowFocus: true,
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
}
