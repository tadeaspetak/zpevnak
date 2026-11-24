import { Text } from '@mantine/core';
import type { SongRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';

/**
 * Who else a private song reaches by going into a playlist: everyone in it reads it, and
 * whoever joins later too (D128). Only its owner can put it where that is news, so it is said to
 * the owner, before they tick; with nobody else in the playlist yet, the later ones are the news.
 * `listmates`: the playlist's people besides the viewer (its `listmateCount`).
 */
export function PrivateSongReach({
  song,
  listmates,
}: {
  song: SongRecord;
  listmates: number | null;
}) {
  const { t, tn } = useI18n();
  if (song.status !== 'private' || song.role !== 'owner') {
    return null;
  }
  return (
    <Text size="xs" c="dimmed">
      {listmates
        ? t('songs.seenByListmates', {
            listmates: tn('playlists.collaborators', listmates),
          })
        : t('songs.seenByJoiners')}
    </Text>
  );
}
