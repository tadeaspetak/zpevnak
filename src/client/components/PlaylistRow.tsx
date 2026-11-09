import { Group, Text, UnstyledButton } from '@mantine/core';
import { IconListDetails, IconWorld } from '@tabler/icons-react';
import { Link } from 'react-router';
import type { PlaylistRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';
import { url } from '../urls.ts';
import classes from './SongRow.module.css';

/** A playlist in a list: the same row shape as a song, with a playlist icon in front. */
export function PlaylistRow({
  playlist,
  active,
}: {
  playlist: PlaylistRecord;
  active?: boolean;
}) {
  const { t, tn } = useI18n();
  return (
    <UnstyledButton
      component={Link}
      to={url.playlist(playlist.id)}
      className={classes.row}
      data-active={active || undefined}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <IconListDetails size={20} className={classes.playlistIcon} />
        <div className={classes.text}>
          <Group gap={6} wrap="nowrap">
            <Text fw={600} truncate>
              {playlist.name}
            </Text>
            {playlist.isMine && playlist.isPublic && (
              <IconWorld size={14} aria-label={t('common.public')} />
            )}
          </Group>
          <Text size="sm" c="dimmed" truncate>
            {tn('common.songs', playlist.songIds.length)}
            {!playlist.isMine && ` · ${t('playlists.by', { name: playlist.ownerName })}`}
          </Text>
        </div>
      </Group>
    </UnstyledButton>
  );
}
