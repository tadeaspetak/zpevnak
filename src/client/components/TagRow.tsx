import { Box, Group, Text, UnstyledButton } from '@mantine/core';
import { IconTag } from '@tabler/icons-react';
import { Link } from 'react-router';
import { url } from '#shared/urls.ts';
import type { Tag } from '../data/tags.ts';
import { useI18n } from '../i18n/index.tsx';
import classes from './SongRow.module.css';

/** A tag in a list: the same row shape as a song, with a tag in front and its song count. */
export function TagRow({ tag, active }: { tag: Tag; active?: boolean }) {
  const { tn } = useI18n();
  return (
    <UnstyledButton
      component={Link}
      to={url.tag(tag.name)}
      className={classes.row}
      data-active={active || undefined}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <IconTag size={20} className={classes.tagIcon} />
        <Box flex={1} miw={0}>
          <Text fw={600} truncate>
            {tag.name}
          </Text>
          <Text size="sm" c="dimmed" truncate>
            {tn('common.songs', tag.songIds.length)}
          </Text>
        </Box>
      </Group>
    </UnstyledButton>
  );
}
