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
};

/** Previous and next, always in reach at the bottom while playing a playlist. */
export function PlaylistBar({
  name,
  position,
  total,
  nextSongId,
  onPrev,
  onNext,
}: Props) {
  const { t } = useI18n();
  const { songs } = useCatalog();
  const nextSong = nextSongId === undefined ? undefined : songs.get(nextSongId);
  return (
    <nav className={classes.bar} aria-label={name}>
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
