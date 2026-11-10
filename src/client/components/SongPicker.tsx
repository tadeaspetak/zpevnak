import { Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { IconCheck, IconPlus } from '@tabler/icons-react';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useCatalog } from '../data/catalog.ts';
import { useSongSearch } from '../data/search.ts';
import { useI18n } from '../i18n/index.tsx';
import { NothingFound } from './SearchResults.tsx';
import { StatusBadge } from './StatusBadge.tsx';
import classes from './SongPicker.module.css';

const MAX_RESULTS = 30;

type Props = {
  opened: boolean;
  onClose: () => void;
  /** The playlist the songs are for: a song it doesn't find can be added for it. */
  playlistId: number;
  /** The playlist's songs, in order. */
  songIds: number[];
  /** Adds or removes the song (see `toggleSong`). */
  onToggle: (songId: number) => void;
};

/**
 * Picks songs for a playlist, as a checklist: each result is in the playlist or not.
 * ↑ ↓ move the highlight, Enter toggles it. Focus stays in the search box, and after a toggle
 * its text is selected: typing starts the next search, the arrows carry on through these
 * results. Space stays a space in the box (searches have several words); on the list itself,
 * reached by Tab, Space toggles too.
 */
export function SongPicker({ opened, onClose, playlistId, songIds, onToggle }: Props) {
  const { t } = useI18n();
  const { songs } = useCatalog();
  const search = useSongSearch(songs);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const hits = useMemo(() => search(query).slice(0, MAX_RESULTS), [search, query]);
  const inPlaylist = useMemo(() => new Set(songIds), [songIds]);
  const current = hits[Math.min(highlight, hits.length - 1)];

  const toggle = (songId: number) => {
    onToggle(songId);
    input.current?.select();
  };

  const move = (by: 1 | -1) => {
    setHighlight((i) => {
      const next = Math.max(0, Math.min(hits.length - 1, i + by));
      document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' });
      return next;
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, spaceToggles: boolean) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if ((e.key === 'Enter' || (spaceToggles && e.key === ' ')) && current) {
      e.preventDefault();
      toggle(current.song.id);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      onExitTransitionEnd={() => setQuery('')}
      title={t('playlists.addSongs')}
      size="lg"
    >
      <Stack gap="sm">
        <TextInput
          ref={input}
          data-autofocus
          type="search"
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls={listId}
          aria-activedescendant={
            current ? `${listId}-${hits.indexOf(current)}` : undefined
          }
          aria-label={t('playlists.addSongs')}
          placeholder={t('home.searchPlaceholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            setHighlight(0);
          }}
          onKeyDown={(e) => onKeyDown(e, false)}
          autoComplete="off"
          spellCheck={false}
        />
        <div
          id={listId}
          role="listbox"
          aria-multiselectable
          aria-label={t('playlists.addSongs')}
          tabIndex={hits.length > 0 ? 0 : -1}
          className={classes.list}
          onKeyDown={(e) => onKeyDown(e, true)}
        >
          {hits.map(({ song }, index) => {
            const selected = inPlaylist.has(song.id);
            return (
              <div
                key={song.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                data-highlighted={song.id === current?.song.id || undefined}
                className={classes.row}
                onMouseMove={() => setHighlight(index)}
                onClick={() => toggle(song.id)}
              >
                <Group justify="space-between" wrap="nowrap">
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
                  </div>
                  <span className={classes.mark} data-selected={selected || undefined}>
                    {selected ? <IconCheck size={18} /> : <IconPlus size={18} />}
                  </span>
                </Group>
              </div>
            );
          })}
        </div>
        {hits.length === 0 && query.trim() && (
          <NothingFound query={query} playlistId={playlistId} />
        )}
      </Stack>
    </Modal>
  );
}
