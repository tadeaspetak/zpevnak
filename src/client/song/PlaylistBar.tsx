import { ActionIcon, Group, Text, UnstyledButton } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useCatalog } from '../data/catalog.ts';
import { useI18n } from '../i18n/index.tsx';
import classes from './PlaylistBar.module.css';

type Props = {
  name: string;
  position: number;
  total: number;
  nextSongId: number | undefined;
  onPrev: (() => void) | undefined;
  onNext: (() => void) | undefined;
  /** Out of the way, with the toolbar: scrolled into the song, or the reader tapped it. */
  hidden: boolean;
};

/**
 * Previous and next, at the bottom while playing a playlist. It goes away with the toolbar
 * (D109); swiping and the arrow keys still move through the playlist meanwhile.
 */
export function PlaylistBar({
  name,
  position,
  total,
  nextSongId,
  onPrev,
  onNext,
  hidden,
}: Props) {
  const { t } = useI18n();
  const { songs } = useCatalog();
  const nextSong = nextSongId === undefined ? undefined : songs.get(nextSongId);
  return (
    <nav
      className={classes.bar}
      aria-label={name}
      data-bottom-overlay
      data-hidden={hidden || undefined}
    >
      <Group gap="xs" wrap="nowrap" className={classes.inner}>
        <ActionIcon
          variant="default"
          size={48}
          radius="xl"
          onClick={onPrev}
          disabled={!onPrev}
          aria-label={t('song.previous')}
        >
          <IconChevronLeft size={26} />
        </ActionIcon>
        <UnstyledButton
          className={classes.middle}
          onClick={onNext}
          disabled={!onNext}
          tabIndex={-1}
          aria-hidden
        >
          <Text size="xs" c="dimmed" truncate>
            {name} · {t('session.position', { position, total })}
          </Text>
          <Text size="sm" fw={600} truncate>
            {nextSong
              ? t('song.nextUp', { title: nextSong.title })
              : t('song.lastInPlaylist')}
          </Text>
        </UnstyledButton>
        <ActionIcon
          variant="filled"
          color="orange"
          size={48}
          radius="xl"
          onClick={onNext}
          disabled={!onNext}
          aria-label={t('song.next')}
        >
          <IconChevronRight size={26} />
        </ActionIcon>
      </Group>
    </nav>
  );
}
