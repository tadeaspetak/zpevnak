import { Badge, Button, Group, Stack, Tabs, Text, Title } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { NotesList } from '../components/NotesList.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { PageLoader } from '../components/PageLoader.tsx';
import { SongRow } from '../components/SongRow.tsx';
import { UsersList } from '../components/UsersList.tsx';
import { VerifyEmailAlert } from '../components/VerifyEmailAlert.tsx';
import { syncCatalog, useCatalog } from '../data/catalog.ts';
import { writeLocalJson } from '../data/local.ts';
import { sortByTitle } from '../data/search.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { inFilter, notesBy } from '../data/notes.ts';
import { trpc } from '../trpc.ts';
import { url } from '#shared/urls.ts';

type Tab = 'songs' | 'notes' | 'users';

export function AccountPage() {
  const { t, compare } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { me, isAdmin, known } = useMe();
  // The tab is in the address, so back and reload keep it, and a song opened from one's notes
  // leads back to them (D139).
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab');
  const tab: Tab = asked === 'notes' || (asked === 'users' && isAdmin) ? asked : 'songs';
  const setTab = (next: Tab) =>
    setParams(next === 'songs' ? {} : { tab: next }, { replace: true });
  const { songs, notes } = useCatalog();
  const openTodos = useMemo(
    () => notesBy(notes, songs, me?.id).filter((n) => inFilter(n, 'todo')).length,
    [notes, songs, me?.id],
  );
  const mySongs = useMemo(
    () =>
      me
        ? sortByTitle(
            [...songs.values()].filter((s) => s.createdBy === me.id),
            compare,
          )
        : [],
    [songs, me, compare],
  );
  const logOut = trpc.auth.logOut.useMutation({
    onSuccess: async () => {
      writeLocalJson('me', null);
      queryClient.clear();
      await syncCatalog(null);
      navigate(url.home());
    },
  });

  if (known && !me) {
    return <Navigate to={url.logIn(`${location.pathname}${location.search}`)} replace />;
  }
  if (!me) {
    return <PageLoader full />;
  }
  const songList =
    mySongs.length === 0 ? (
      <Text c="dimmed">{t('account.noSongs')}</Text>
    ) : (
      <Stack gap={0} mx="-md">
        {mySongs.map((song) => (
          <SongRow
            key={song.id}
            song={song}
            to={url.song(song)}
            detail={
              song.rejection && (
                <Text size="sm" c="red">
                  {t('song.rejectedNote', {
                    reason: t(`reason.${song.rejection.reason}`),
                  })}
                </Text>
              )
            }
          />
        ))}
      </Stack>
    );

  return (
    <>
      <PageHeader
        title={t('account.title')}
        backTo={url.home()}
        backLabel={t('nav.backHome')}
      />
      <Page>
        <Stack gap="xl">
          {!me.emailVerified && <VerifyEmailAlert message={t('account.verifyBanner')} />}

          {/* Who is signed in, and the way out, together at the top: a long song list
              below can't push logging out out of reach. */}
          <Group justify="space-between" align="flex-start" gap="sm">
            <div>
              <Group gap="xs">
                <Title order={2} size="h4">
                  {me.displayName}
                </Title>
                <Badge>{t(`account.role.${me.role}`)}</Badge>
              </Group>
              <Text c="dimmed">{me.email}</Text>
            </div>
            <Button
              variant="default"
              size="sm"
              loading={logOut.isPending}
              onClick={() => logOut.mutate()}
            >
              {t('account.logOut')}
            </Button>
          </Group>

          {/* Everyone's own songs and notes; for admins, everyone's accounts too (D113, D139).
              Short names, "my" being the page's: three, and a TODO count, fit on a phone. */}
          <Tabs
            value={tab}
            onChange={(v) => setTab(v === 'notes' || v === 'users' ? v : 'songs')}
          >
            <Tabs.List mb="md">
              <Tabs.Tab value="songs">{t('account.tab.songs')}</Tabs.Tab>
              <Tabs.Tab
                value="notes"
                rightSection={
                  openTodos > 0 && (
                    <Badge
                      size="sm"
                      aria-label={t('notes.openTodos', { count: openTodos })}
                    >
                      {openTodos}
                    </Badge>
                  )
                }
              >
                {t('account.tab.notes')}
              </Tabs.Tab>
              {isAdmin && <Tabs.Tab value="users">{t('nav.users')}</Tabs.Tab>}
            </Tabs.List>
            <Tabs.Panel value="songs">{songList}</Tabs.Panel>
            <Tabs.Panel value="notes">
              <NotesList me={me} />
            </Tabs.Panel>
            {isAdmin && (
              <Tabs.Panel value="users">
                <UsersList />
              </Tabs.Panel>
            )}
          </Tabs>
        </Stack>
      </Page>
    </>
  );
}

/** Where Moje poznámky was its own page (/notes): now the account's tab, the filter kept (D139). */
export function NotesRedirect() {
  const [params] = useSearchParams();
  const filter = params.get('filter');
  return (
    <Navigate
      to={url.notes(filter === 'todo' || filter === 'done' ? filter : undefined)}
      replace
    />
  );
}
