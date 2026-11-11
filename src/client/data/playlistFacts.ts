import type { useI18n } from '../i18n/index.tsx';
import type { PlaylistRecord } from './store.ts';

type I18n = Pick<ReturnType<typeof useI18n>, 't' | 'tn'>;

/**
 * What to say about a playlist under its name, worded once for every place that shows it
 * (D112): its songs; for someone else's, whose it is (the name alone, as an artist under a
 * song); for one's own, how many listmates, when there are any. Public is shown apart, as a
 * mark: private is the normal case and says nothing.
 */
export function playlistFacts(playlist: PlaylistRecord, { tn }: I18n) {
  const line = [
    tn('common.songs', playlist.songIds.length),
    playlist.role === 'owner' ? null : playlist.ownerName,
    playlist.role === 'owner' && playlist.collaboratorCount
      ? tn('playlists.collaborators', playlist.collaboratorCount)
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return { line, isPublic: playlist.isPublic };
}

/**
 * Playlists by whose they are: one's own, those shared with one, and others' public ones.
 * Within each, the most recently played (or made, or joined) first, then the latest changed.
 */
export function groupPlaylists(
  playlists: Iterable<PlaylistRecord>,
  recent: Record<number, number>,
) {
  const sorted = [...playlists].sort(
    (a, b) =>
      (recent[b.id] ?? 0) - (recent[a.id] ?? 0) || b.updatedAt.localeCompare(a.updatedAt),
  );
  return {
    mine: sorted.filter((p) => p.role === 'owner'),
    shared: sorted.filter((p) => p.role === 'collaborator'),
    others: sorted.filter((p) => p.role === null),
  };
}
