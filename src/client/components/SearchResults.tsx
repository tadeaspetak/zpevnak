import { Anchor, Stack, Text, Title } from '@mantine/core';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCatalog } from '../data/catalog.ts';
import { searchPlaylists, useSongSearch } from '../data/search.ts';
import type { PlaylistRecord } from '../data/store.ts';
import type { SearchHit } from '../data/search.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { url } from '../urls.ts';
import { PlaylistRow } from './PlaylistRow.tsx';
import { SongRow, songLinkState } from './SongRow.tsx';

const MAX_PLAYLISTS = 5;

type Item =
  | { kind: 'playlist'; playlist: PlaylistRecord; to: string }
  | { kind: 'song'; hit: SearchHit; to: string };

/**
 * Songs and playlists matching a query, with keyboard selection (↑ ↓ Enter). Used by the
 * overview's search and by the search overlay, so both find the same things the same way.
 */
export function useSearchResults(query: string) {
  const { songs, playlists } = useCatalog();
  const searchSongs = useSongSearch(songs);
  const navigate = useNavigate();
  const items = useMemo<Item[]>(
    () => [
      ...searchPlaylists(playlists.values(), query)
        .slice(0, MAX_PLAYLISTS)
        .map((playlist) => ({
          kind: 'playlist' as const,
          playlist,
          to: url.playlist(playlist),
        })),
      ...searchSongs(query).map((hit) => ({
        kind: 'song' as const,
        hit,
        to: url.song(hit.song),
      })),
    ],
    [playlists, searchSongs, query],
  );
  const [selected, setSelected] = useState(0);
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setSelected(0);
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && items[selected]) {
      e.preventDefault();
      navigate(items[selected].to, { state: songLinkState(window.location) });
    }
  };

  return { items, selected, onKeyDown };
}

type Props = {
  query: string;
  items: Item[];
  /** Highlight the keyboard selection: only where a keyboard is likely. */
  selected: number | null;
};

export function SearchResults({ query, items, selected }: Props) {
  const { t } = useI18n();
  if (items.length === 0) {
    return <NothingFound query={query} />;
  }
  const playlistItems = items.filter((i) => i.kind === 'playlist');
  const songItems = items.filter((i) => i.kind === 'song');
  const isSelected = (item: Item) => selected !== null && items[selected] === item;
  return (
    <Stack gap="lg" aria-live="polite">
      {playlistItems.length > 0 && (
        <section>
          <ResultsHeading>{t('search.playlists')}</ResultsHeading>
          <Stack gap={0} mx="-md">
            {playlistItems.map((item) => (
              <PlaylistRow
                key={`p${item.playlist.id}`}
                playlist={item.playlist}
                active={isSelected(item)}
              />
            ))}
          </Stack>
        </section>
      )}
      {songItems.length > 0 && (
        <section>
          {playlistItems.length > 0 && (
            <ResultsHeading>{t('search.songs')}</ResultsHeading>
          )}
          <Stack gap={0} mx="-md">
            {songItems.map((item) => (
              <SongRow
                key={`s${item.hit.song.id}`}
                song={item.hit.song}
                to={item.to}
                active={isSelected(item)}
                detail={
                  item.hit.lyricsLine && (
                    <Text size="sm" fs="italic" truncate>
                      „{item.hit.lyricsLine}“
                    </Text>
                  )
                }
              />
            ))}
          </Stack>
        </section>
      )}
    </Stack>
  );
}

/**
 * A search that found nothing, and the way on from it: the song isn't here yet, so whoever may
 * add songs can start it with the title they searched for.
 */
export function NothingFound({
  query,
  playlistId,
}: {
  query: string;
  playlistId?: number;
}) {
  const { t } = useI18n();
  const { me } = useMe();
  return (
    <Stack align="center" gap="xs" py="xl">
      <Text c="dimmed" ta="center">
        {t('home.noResults', { query })}
      </Text>
      {me?.emailVerified && query.trim() && (
        <Anchor
          component={Link}
          to={url.newSong({ title: query, playlistId })}
          ta="center"
        >
          {t('editor.addMissing', { title: query.trim() })}
        </Anchor>
      )}
    </Stack>
  );
}

function ResultsHeading({ children }: { children: string }) {
  return (
    <Title order={2} fz="sm" fw={700} c="dimmed" mb={4}>
      {children}
    </Title>
  );
}
