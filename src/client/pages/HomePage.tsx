import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  Indicator,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconChecklist,
  IconPlaylist,
  IconPlus,
  IconSearch,
  IconUserCircle,
  IconWifiOff,
  IconX,
} from '@tabler/icons-react';
import { useMemo, useRef, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Footer } from '../components/Footer.tsx';
import { PlaylistPill } from '../components/PlaylistPill.tsx';
import { PlaylistRow } from '../components/PlaylistRow.tsx';
import { SearchResults, useSearchResults } from '../components/SearchResults.tsx';
import { RefreshButton } from '../components/RefreshButton.tsx';
import { SettingsButton } from '../components/SettingsModal.tsx';
import { SongRow } from '../components/SongRow.tsx';
import { inSearch } from '#shared/songs.ts';
import { useCatalog } from '../data/catalog.ts';
import { sortByTitle } from '../data/search.ts';
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
// keyboard over the playlists the player may have come for (D35). Fine pointers only.
const focusOnOpen = window.matchMedia('(pointer: fine)').matches;

export function HomePage() {
  const { t, tn, locale } = useI18n();
  const { me, isEditor } = useMe();
  const online = useOnline();
  const { songs, playlists, loaded, synced } = useCatalog();
  const { recentPlaylists, recentSongs, session } = usePlayer();
  const inputRef = useRef<HTMLInputElement>(null);

  // The query lives in the address, so coming back from a song finds the same results.
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const setQuery = (q: string) => setParams(q ? { q } : {}, { replace: true });
  const { items, selected, onKeyDown } = useSearchResults(query);

  useKeys(useMemo(() => ({ '/': () => inputRef.current?.focus() }), []));

  // Every pending song is in every catalog, so the device counts them itself: no request,
  // and right offline too.
  const waiting = useMemo(
    () => [...songs.values()].filter((s) => s.status === 'pending').length,
    [songs],
  );
  // Song lists show what can be found: a rejected song only to its author (D77).
  const findable = useMemo(
    () => [...songs.values()].filter((s) => inSearch(s, me?.id ?? null)),
    [songs, me],
  );
  const allSongs = useMemo(() => sortByTitle(findable, locale), [findable, locale]);
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
    .filter((s) => inSearch(s, me?.id ?? null))
    .slice(0, RECENT_SONGS);

  return (
    <div className={classes.page} data-has-pill={session ? true : undefined}>
      <header className={classes.header}>
        <Container size="48rem" px="md">
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
                <Indicator label={waiting} size={18} offset={6} disabled={waiting === 0}>
                  <NavIcon
                    to={url.queue()}
                    label={
                      waiting > 0
                        ? t('nav.queueWaiting', { count: waiting })
                        : t('nav.queue')
                    }
                    icon={<IconChecklist />}
                  />
                </Indicator>
              )}
              <RefreshButton />
              <SettingsButton />
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
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuery('');
              } else {
                onKeyDown(e);
              }
            }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
          />
        </Container>
      </header>

      <Container size="48rem" px="md" component="main">
        {query ? (
          <SearchResults
            query={query}
            items={items}
            selected={focusOnOpen ? selected : null}
          />
        ) : !loaded || (!synced && songs.size === 0 && online) ? (
          <Group justify="center" py="xl" gap="sm">
            <Loader size="sm" />
            <Text c="dimmed">{t('home.loadingCatalog')}</Text>
          </Group>
        ) : (
          <Stack gap="xl" pt="sm">
            {recentPlaylistList.length > 0 && (
              <Section
                title={t('home.recentPlaylists')}
                aside={
                  <Anchor component={Link} to={url.playlists()} size="sm">
                    {t('home.allPlaylists')}
                  </Anchor>
                }
              >
                {recentPlaylistList.map((p) => (
                  <PlaylistRow key={p.id} playlist={p} />
                ))}
              </Section>
            )}

            {recentSongList.length > 0 && (
              <Section title={t('home.recentSongs')}>
                {recentSongList.map((song) => (
                  <SongRow key={song.id} song={song} to={url.song(song)} />
                ))}
              </Section>
            )}

            <Section
              title={t('home.allSongs')}
              aside={
                <Text size="sm" c="dimmed">
                  {tn('common.songs', allSongs.length)}
                </Text>
              }
            >
              {allSongs.length === 0 ? (
                <Text c="dimmed" py="md" px="md">
                  {t('home.emptyCatalog')}
                </Text>
              ) : (
                allSongs.map((song) => (
                  <SongRow key={song.id} song={song} to={url.song(song)} />
                ))
              )}
            </Section>
          </Stack>
        )}
        <Footer />
      </Container>
      <PlaylistPill />
    </div>
  );
}

function NavIcon({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
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

/**
 * A titled group of rows. The title is a real heading, bold and set on a rule, so it reads as
 * structure and not as one more row.
 */
function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <Group justify="space-between" align="baseline" className={classes.sectionHead}>
        <Title order={2} fz="lg" fw={700}>
          {title}
        </Title>
        {aside}
      </Group>
      <Stack gap={0} mx="-md">
        {children}
      </Stack>
    </section>
  );
}
