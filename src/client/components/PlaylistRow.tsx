import { Group, Text, UnstyledButton } from '@mantine/core';
import { IconListDetails } from '@tabler/icons-react';
import { Link } from 'react-router';
import { playlistFacts } from '../data/playlistFacts.ts';
import type { PlaylistRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';
import { url } from '../urls.ts';
import classes from './SongRow.module.css';

/**
 * A playlist in a list: the same row shape as a song, with a playlist icon in front and the
 * same facts as the playlists table (`playlistFacts`) under the name.
 */
export function PlaylistRow({
  playlist,
  active,
}: {
  playlist: PlaylistRecord;
  active?: boolean;
}) {
  const { t, tn } = useI18n();
  const { role, visibility } = playlistFacts(playlist, t);
  return (
    <UnstyledButton
      component={Link}
      to={url.playlist(playlist)}
      className={classes.row}
      data-active={active || undefined}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <IconListDetails size={20} className={classes.playlistIcon} />
        <div className={classes.text}>
          <Text fw={600} truncate>
            {playlist.name}
          </Text>
          <Text size="sm" c="dimmed" truncate>
            {[tn('common.songs', playlist.songIds.length), role, visibility].join(' · ')}
          </Text>
        </div>
      </Group>
    </UnstyledButton>
  );
}
