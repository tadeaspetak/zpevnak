import { CloseButton, Group, Text, UnstyledButton } from '@mantine/core';
import { IconPlayerPlayFilled } from '@tabler/icons-react';
import { Link } from 'react-router';
import { useCatalog } from '../data/catalog.ts';
import { leavePlaylist, usePlayer } from '../data/session.ts';
import { useI18n } from '../i18n/index.tsx';
import { url } from '../urls.ts';
import classes from './PlaylistPill.module.css';

/**
 * "Back to the playlist", wherever the player wandered off to. Floats at the bottom of the
 * screen until they go back or leave the playlist.
 */
export function PlaylistPill() {
  const { t } = useI18n();
  const { session } = usePlayer();
  const { playlists, songs } = useCatalog();
  const playlist = session ? playlists.get(session.playlistId) : undefined;
  if (!session || !playlist) {
    return null;
  }
  const total = playlist.songIds.length;
  const position = Math.min(session.position, total);
  const song = songs.get(playlist.songIds[position - 1] ?? -1);
  return (
    <div className={classes.dock}>
      <Group gap={0} wrap="nowrap" className={classes.pill}>
        <UnstyledButton
          component={Link}
          to={url.playlistSong(playlist, position)}
          className={classes.main}
          aria-label={t('session.backTo', { name: playlist.name })}
        >
          <Group gap="sm" wrap="nowrap">
            <IconPlayerPlayFilled size={18} className={classes.icon} />
            <div className={classes.text}>
              <Text size="sm" fw={600} truncate>
                {playlist.name}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {t('session.position', { position, total })}
                {song ? ` · ${song.title}` : ''}
              </Text>
            </div>
          </Group>
        </UnstyledButton>
        <CloseButton
          onClick={leavePlaylist}
          aria-label={t('session.leave')}
          size="lg"
          className={classes.close}
        />
      </Group>
    </div>
  );
}
