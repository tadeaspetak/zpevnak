import { Badge, Button, Group, Stack, Tabs, Text, Title } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
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
import { trpc } from '../trpc.ts';
import { url } from '#shared/urls.ts';

export function AccountPage() {
  const { t, compare } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { me, isAdmin, known } = useMe();
  // The tab is in the address, so back and reload keep it.
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'users' ? 'users' : 'songs';
  const setTab = (next: 'songs' | 'users') =>
    setParams(next === 'users' ? { tab: 'users' } : {}, { replace: true });
  const { songs } = useCatalog();
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
    return <Navigate to={url.logIn(url.account())} replace />;
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

          {/* Admins get a tab of everyone's accounts; for anyone else, just their songs. */}
          {isAdmin ? (
            <Tabs value={tab} onChange={(v) => setTab(v === 'users' ? 'users' : 'songs')}>
              <Tabs.List mb="sm">
                <Tabs.Tab value="songs">{t('account.mySongs')}</Tabs.Tab>
                <Tabs.Tab value="users">{t('nav.users')}</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="songs">{songList}</Tabs.Panel>
              <Tabs.Panel value="users">
                <UsersList />
              </Tabs.Panel>
            </Tabs>
          ) : (
            <section>
              <Title order={2} size="h5" mb={4}>
                {t('account.mySongs')}
              </Title>
              {songList}
            </section>
          )}
        </Stack>
      </Page>
    </>
  );
}
