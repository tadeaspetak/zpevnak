import { useEffect } from 'react';
import type { Me } from '#server/auth/me.ts';
import { readLocalJson, writeLocalJson } from '../data/local.ts';
import { trpc } from '../trpc.ts';

/**
 * The signed-in user, or null. Offline, the last known answer stands in, so a musician with
 * no signal still sees their own playlists rather than a signed-out app.
 */
export function useMe() {
  const query = trpc.auth.me.useQuery(undefined, { staleTime: 5 * 60_000, retry: 1 });
  useEffect(() => {
    if (query.isSuccess) {
      writeLocalJson('me', query.data);
    }
  }, [query.isSuccess, query.data]);
  const me: Me | null = query.isSuccess
    ? query.data
    : readLocalJson<Me | null>('me', null);
  const isEditor = me?.role === 'editor' || me?.role === 'admin';
  return {
    me,
    isEditor,
    isAdmin: me?.role === 'admin',
    known: query.isSuccess || query.isError,
  };
}
