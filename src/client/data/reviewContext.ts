import type { RejectionReason } from '#shared/validators/index.ts';
import type { useI18n } from '../i18n/index.tsx';
import type { PlaylistRecord } from './store.ts';

type I18n = Pick<ReturnType<typeof useI18n>, 't' | 'compare'>;

/**
 * What makes a waiting song matter, worded once for the queue and the review screen: the
 * playlists it's in (a gig wants it), and that it is back after a rejection. Playlists are the
 * ones this editor can see, from their catalog.
 */
export function reviewContext(
  songId: number,
  lastRejection: { reason: RejectionReason; note: string | null } | null,
  playlists: Iterable<PlaylistRecord>,
  { t, compare }: I18n,
): string[] {
  const names = [...playlists]
    .filter((p) => p.songIds.includes(songId))
    .map((p) => p.name)
    .sort(compare);
  return [
    names.length === 1 ? t('queue.inPlaylist', { name: names[0] ?? '' }) : null,
    names.length > 1 ? t('queue.inPlaylists', { names: names.join(', ') }) : null,
    lastRejection ? t('queue.fixedAfterRejection') : null,
  ].filter((part) => part !== null);
}
