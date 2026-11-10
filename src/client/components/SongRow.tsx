import { Box, Group, Text, UnstyledButton } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import type { SongRecord } from '../data/store.ts';
import { StatusBadge } from './StatusBadge.tsx';
import classes from './SongRow.module.css';

/**
 * Carried by a link into a song from the overview's search results, so the song's back arrow
 * (which goes up to the overview, D60) lands on those same results rather than an empty search.
 */
export type SongLinkState = { backTo: string };

/** The link state for a song opened from here: only search results on the overview carry one. */
export function songLinkState(location: {
  pathname: string;
  search: string;
}): SongLinkState | undefined {
  return location.pathname === '/' && new URLSearchParams(location.search).has('q')
    ? { backTo: `/${location.search}` }
    : undefined;
}

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
      state={songLinkState(location)}
      className={classes.row}
      data-active={active || undefined}
      aria-current={active || undefined}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        {leading}
        <SongLabel song={song}>{detail}</SongLabel>
      </Group>
    </UnstyledButton>
  );
}

/**
 * A song as every list shows it: the title, marked when it isn't approved, the artist under it,
 * and anything a list adds (`children`). Takes the room left in its row, cutting long names.
 */
export function SongLabel({
  song,
  children,
}: {
  song: SongRecord;
  children?: ReactNode;
}) {
  return (
    <Box flex={1} miw={0}>
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
      {children}
    </Box>
  );
}
