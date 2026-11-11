import { Box, Group, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconListDetails, IconWorld } from '@tabler/icons-react';
import { Link } from 'react-router';
import { url } from '#shared/urls.ts';
import { playlistFacts } from '../data/playlistFacts.ts';
import type { PlaylistRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';
import classes from './SongRow.module.css';

/**
 * A playlist in a list: the same row shape as a song, with a playlist icon in front and its
 * facts under the name (`playlistFacts`, D112).
 */
export function PlaylistRow({
  playlist,
  active,
}: {
  playlist: PlaylistRecord;
  active?: boolean;
}) {
  const { t, tn } = useI18n();
  const { line, isPublic } = playlistFacts(playlist, { t, tn });
  return (
    <UnstyledButton
      component={Link}
      to={url.playlist(playlist)}
      className={classes.row}
      data-active={active || undefined}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <IconListDetails size={20} className={classes.playlistIcon} />
        <Box flex={1} miw={0}>
          <Group gap={6} wrap="nowrap">
            <Text fw={600} truncate>
              {playlist.name}
            </Text>
            {isPublic && <PublicMark />}
          </Group>
          <Text size="sm" c="dimmed" truncate>
            {line}
          </Text>
        </Box>
      </Group>
    </UnstyledButton>
  );
}

/** A public playlist, marked: anyone may look. Private is the normal case and unmarked. */
export function PublicMark() {
  const { t } = useI18n();
  return (
    <Tooltip label={t('playlists.publicMark')}>
      <IconWorld
        size={16}
        aria-label={t('playlists.publicMark')}
        role="img"
        style={{ flexShrink: 0, color: 'var(--mantine-color-dimmed)' }}
      />
    </Tooltip>
  );
}
