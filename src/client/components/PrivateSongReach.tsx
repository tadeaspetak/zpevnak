import { Text } from '@mantine/core';
import type { SongRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';

/**
 * Who else a private song reaches by going into a playlist: everyone in it reads it (D128), and
 * only its owner can put it where that is news, so it is said to the owner, before they tick.
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
  if (song.status !== 'private' || song.role !== 'owner' || !listmates) {
    return null;
  }
  return (
    <Text size="xs" c="dimmed">
      {t('songs.seenByListmates', {
        listmates: tn('playlists.collaborators', listmates),
      })}
    </Text>
  );
}
