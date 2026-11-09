import type { useI18n } from '../i18n/index.tsx';
import type { PlaylistRecord } from './store.ts';

type T = ReturnType<typeof useI18n>['t'];

/**
 * How a playlist relates to the viewer, worded once for every place that shows it (the table,
 * rows on a phone, search results): the role, or whose it is; and who can see it.
 */
export function playlistFacts(playlist: PlaylistRecord, t: T) {
  const role = playlist.role
    ? t(`playlists.role.${playlist.role}`)
    : t('playlists.by', { name: playlist.ownerName });
  const visibility = [
    playlist.isPublic ? t('common.public') : t('common.private'),
    playlist.collaboratorCount > 0
      ? t('playlists.shared', { count: playlist.collaboratorCount })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return { role, visibility };
}
