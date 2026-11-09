import type { useI18n } from '../i18n/index.tsx';
import type { PlaylistRecord } from './store.ts';

type I18n = Pick<ReturnType<typeof useI18n>, 't' | 'tn'>;

/**
 * How a playlist relates to the viewer, worded once for every place that shows it (D79):
 * - `role`: the viewer's part in it, or whose it is ("od Tadeáš") for someone else's;
 * - `visibility`: public or private, and for its own people how many collaborators it has.
 * Search results and the overview show only the songs and `role`; the playlists page the rest.
 */
export function playlistFacts(playlist: PlaylistRecord, { t, tn }: I18n) {
  const role = playlist.role
    ? t(`playlists.role.${playlist.role}`)
    : t('playlists.by', { name: playlist.ownerName });
  const visibility = [
    playlist.isPublic ? t('common.public') : t('common.private'),
    playlist.collaboratorCount
      ? tn('playlists.collaborators', playlist.collaboratorCount)
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return { role, visibility };
}
