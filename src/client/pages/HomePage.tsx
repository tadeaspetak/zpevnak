import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconListDetails,
  IconPlaylist,
  IconPlus,
  IconSearch,
  IconChecklist,
  IconUserCircle,
  IconWifiOff,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { PlaylistPill } from '../components/PlaylistPill.tsx';
import { Settings } from './AccountPage.tsx';
import { SongRow } from '../components/SongRow.tsx';
import { useCatalog } from '../data/catalog.ts';
import { sortByTitle, useSongSearch } from '../data/search.ts';
import { usePlayer } from '../data/session.ts';
import { useKeys } from '../hooks/useKeys.ts';
import { useMe } from '../hooks/useMe.ts';
import { useOnline } from '../hooks/useOnline.ts';
import { useI18n } from '../i18n/index.tsx';
import { url } from '../urls.ts';
import classes from './HomePage.module.css';

const RECENT_PLAYLISTS = 4;
const RECENT_SONGS = 6;

// Typing right away is the point of this page, but on a phone focusing would throw the
// keyboard over the playlists the player may have come for. Only fine pointers get it.
const focusOnOpen = window.matchMedia('(pointer: fine)').matches;

export function HomePage() {
  const { t, tn, locale } = useI18n();
  const navigate = useNavigate();
  const { me, isEditor } = useMe();
  const online = useOnline();
  const { songs, playlists, loaded, synced } = useCatalog();
  const { recentPlaylists, recentSongs, session } = usePlayer();
  const search = useSongSearch(songs);
  const inputRef = useRef<HTMLInputElement>(null);

  // The query lives in the address, so coming back from a song finds the same results.
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const wantsSearch = params.has('search');
  const setQuery = (q: string) => setParams(q ? { q } : {}, { replace: true });
  const hits = useMemo(() => search(query), [search, query]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (wantsSearch) {
      inputRef.current?.focus();
      setParams({}, { replace: true });
    }
  }, [wantsSearch, setParams]);

  useKeys(
    useMemo(
      () => ({
        '/': () => inputRef.current?.focus(),
      }),
      [],
    ),
  );

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && hits[selected]) {
      navigate(url.song(hits[selected].song));
    } else if (e.key === 'Escape') {
      setQuery('');
    }
  };

  const allSongs = useMemo(() => sortByTitle(songs.values(), locale), [songs, locale]);
  const recentPlaylistList = useMemo(
    () =>
      Object.entries(recentPlaylists)
        .sort(([, a], [, b]) => b - a)
        .flatMap(([id]) => playlists.get(Number(id)) ?? [])
        .slice(0, RECENT_PLAYLISTS),
    [recentPlaylists, playlists],
  );
  const recentSongList = recentSongs
    .flatMap((id) => songs.get(id) ?? [])
    .slice(0, RECENT_SONGS);

  return (
    <div className={classes.page} data-has-pill={session ? true : undefined}>
      <header className={classes.header}>
        <div className={classes.inner}>
          <Group justify="space-between" wrap="nowrap" mb="xs">
            <Group gap="xs" wrap="nowrap">
              <Title order={1} size="h3" className={classes.brand}>
                {t('app.name')}
              </Title>
              {!online && (
                <Tooltip label={t('common.offlineHint')} multiline w={240}>
                  <Badge
                    variant="light"
                    color="gray"
                    leftSection={<IconWifiOff size={12} />}
                  >
                    {t('common.offline')}
                  </Badge>
                </Tooltip>
              )}
            </Group>
            <Group gap={4} wrap="nowrap">
              <NavIcon
                to={url.playlists()}
                label={t('nav.playlists')}
                icon={<IconPlaylist />}
              />
              {me?.emailVerified && (
                <NavIcon
                  to={url.newSong()}
                  label={t('nav.newSong')}
                  icon={<IconPlus />}
                />
              )}
              {isEditor && (
                <NavIcon
                  to={url.queue()}
                  label={t('nav.queue')}
                  icon={<IconChecklist />}
                />
              )}
              {me ? (
                <NavIcon
                  to={url.account()}
                  label={t('nav.account')}
                  icon={<IconUserCircle />}
                />
              ) : (
                <Button component={Link} to={url.logIn()} variant="subtle" size="sm">
                  {t('nav.logIn')}
                </Button>
              )}
            </Group>
          </Group>
          <TextInput
            ref={inputRef}
            type="search"
            size="lg"
            radius="xl"
            autoFocus={focusOnOpen}
            aria-label={t('home.searchLabel')}
            placeholder={t('home.searchPlaceholder')}
            leftSection={<IconSearch size={20} />}
            rightSection={
              query ? (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  aria-label={t('common.close')}
                >
                  <IconX size={18} />
                </ActionIcon>
              ) : null
            }
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value);
              setSelected(0);
            }}
            onKeyDown={onSearchKey}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
          />
        </div>
      </header>

      <main className={classes.inner}>
        {query ? (
          <section aria-live="polite">
            {hits.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                {t('home.noResults', { query })}
              </Text>
            ) : (
              <Stack gap={0}>
                {hits.map((hit, i) => (
                  <SongRow
                    key={hit.song.id}
                    song={hit.song}
                    to={url.song(hit.song)}
                    active={focusOnOpen && i === selected}
                    detail={
                      hit.lyricsLine && (
                        <Text size="sm" fs="italic" truncate>
                          „{hit.lyricsLine}“
                        </Text>
                      )
                    }
                  />
                ))}
              </Stack>
            )}
          </section>
        ) : !loaded || (!synced && songs.size === 0 && online) ? (
          <Group justify="center" py="xl" gap="sm">
            <Loader size="sm" />
            <Text c="dimmed">{t('home.loadingCatalog')}</Text>
          </Group>
        ) : (
          <Stack gap="lg" pt="xs">
            {recentPlaylistList.length > 0 && (
              <section>
                <SectionTitle
                  title={t('home.recentPlaylists')}
                  link={{ to: url.playlists(), label: t('home.allPlaylists') }}
                />
                <div className={classes.playlistGrid}>
                  {recentPlaylistList.map((p) => (
                    <UnstyledButton
                      key={p.id}
                      component={Link}
                      to={url.playlist(p.id)}
                      className={classes.playlistCard}
                    >
                      <Group gap="xs" wrap="nowrap">
                        <IconListDetails size={18} className={classes.playlistIcon} />
                        <div style={{ minWidth: 0 }}>
                          <Text fw={600} size="sm" truncate>
                            {p.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {tn('common.songs', p.songIds.length)}
                          </Text>
                        </div>
                      </Group>
                    </UnstyledButton>
                  ))}
                </div>
              </section>
            )}

            {recentSongList.length > 0 && (
              <section>
                <SectionTitle title={t('home.recentSongs')} />
                <Stack gap={0}>
                  {recentSongList.map((song) => (
                    <SongRow key={song.id} song={song} to={url.song(song)} />
                  ))}
                </Stack>
              </section>
            )}

            <section>
              <SectionTitle
                title={t('home.allSongs')}
                aside={
                  <Text size="sm" c="dimmed">
                    {tn('common.songs', allSongs.length)}
                  </Text>
                }
              />
              {allSongs.length === 0 ? (
                <Text c="dimmed" py="md">
                  {t('home.emptyCatalog')}
                </Text>
              ) : (
                <Stack gap={0}>
                  {allSongs.map((song) => (
                    <SongRow key={song.id} song={song} to={url.song(song)} />
                  ))}
                </Stack>
              )}
            </section>
            <footer className={classes.footer}>
              <Settings />
            </footer>
          </Stack>
        )}
      </main>
      <PlaylistPill />
    </div>
  );
}

function NavIcon({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <ActionIcon
        component={Link}
        to={to}
        variant="subtle"
        color="gray"
        size="lg"
        aria-label={label}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}

function SectionTitle({
  title,
  link,
  aside,
}: {
  title: string;
  link?: { to: string; label: string };
  aside?: React.ReactNode;
}) {
  return (
    <Group justify="space-between" px="md" mb={4}>
      <Title order={2} size="h5" c="dimmed" tt="uppercase" fz="xs" lts="0.04em">
        {title}
      </Title>
      {link && (
        <Anchor component={Link} to={link.to} size="sm">
          {link.label}
        </Anchor>
      )}
      {aside}
    </Group>
  );
}
