import { Box, Group, Text, UnstyledButton } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { byline, songText } from '../data/songText.ts';
import type { SongRecord } from '../data/store.ts';
import { StatusBadge } from './StatusBadge.tsx';
import classes from './SongRow.module.css';

/**
 * Carried by a link from a page that isn't the next page's fixed parent, so its back arrow (one
 * level up, D60) lands where the link was: into a song from the overview's search results (no
 * `backName`) or a tag's songs (the tag's name); into a review from the song itself (its title,
 * D123).
 */
export type SongLinkState = {
  backTo: string;
  backName?: string;
  /** A note to scroll to, from one's notes (D135). */
  note?: number;
};

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
  /** Where the song's back arrow leads instead of its parent; search results by default. */
  linkState?: SongLinkState;
};

export function SongRow({ song, to, detail, leading, active, linkState }: Props) {
  const location = useLocation();
  return (
    <UnstyledButton
      component={Link}
      to={to}
      state={linkState ?? songLinkState(location)}
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
 * A song as every list shows it: the title, marked when it isn't approved, the artist and tags
 * under it (`byline`), and anything a list adds (`children`). Takes the room left in its row,
 * cutting long names.
 */
export function SongLabel({
  song,
  children,
}: {
  song: SongRecord;
  children?: ReactNode;
}) {
  const line = byline(song.artist, songText(song).tags);
  return (
    <Box flex={1} miw={0}>
      <Group gap={6} wrap="nowrap">
        <Text fw={600} truncate>
          {song.title}
        </Text>
        <StatusBadge status={song.status} />
      </Group>
      {line && (
        <Text size="sm" c="dimmed" truncate>
          {line}
        </Text>
      )}
      {children}
    </Box>
  );
}
