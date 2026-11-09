import { Group, Text, UnstyledButton } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import type { SongRecord } from '../data/store.ts';
import { StatusBadge } from './StatusBadge.tsx';
import classes from './SongRow.module.css';

/** Carried by links into a song, so its back arrow returns where the reader came from. */
export type SongLinkState = { backTo: string };

type Props = {
  song: SongRecord;
  to: string;
  /** Shown under the artist, e.g. the lyrics line a search matched. */
  detail?: ReactNode;
  leading?: ReactNode;
  active?: boolean;
};

export function SongRow({ song, to, detail, leading, active }: Props) {
  const location = useLocation();
  return (
    <UnstyledButton
      component={Link}
      to={to}
      state={{ backTo: `${location.pathname}${location.search}` } satisfies SongLinkState}
      className={classes.row}
      data-active={active || undefined}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        {leading}
        <div className={classes.text}>
          <Group gap={6} wrap="nowrap">
            <Text fw={600} truncate>
              {song.title}
            </Text>
            <StatusBadge status={song.status} />
          </Group>
          {song.artist && (
            <Text size="sm" c="dimmed" truncate>
              {song.artist}
            </Text>
          )}
          {detail}
        </div>
      </Group>
    </UnstyledButton>
  );
}
