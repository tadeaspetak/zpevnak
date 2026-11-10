import { Alert, Anchor, Badge, Button, Group, Stack, Text, Title } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ErrorText } from '../components/ErrorText.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { SongRow } from '../components/SongRow.tsx';
import { syncCatalog, useCatalog } from '../data/catalog.ts';
import { writeLocalJson } from '../data/local.ts';
import { sortByTitle } from '../data/search.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';

export function AccountPage() {
  const { t, compare } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { me, isAdmin, known } = useMe();
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
  const resend = trpc.auth.resendVerification.useMutation();
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
    return null;
  }

  return (
    <>
      <PageHeader
        title={t('account.title')}
        backTo={url.home()}
        backLabel={t('nav.backHome')}
      />
      <Page>
        <Stack gap="xl">
          {!me.emailVerified && (
            <Alert color="yellow" variant="light">
              <Stack gap="xs">
                <Text size="sm">{t('account.verifyBanner')}</Text>
                {resend.isSuccess ? (
                  <Text size="sm" fw={600}>
                    {t('account.resent')}
                  </Text>
                ) : (
                  <Button
                    size="xs"
                    variant="default"
                    w="fit-content"
                    loading={resend.isPending}
                    onClick={() => resend.mutate()}
                  >
                    {t('account.resend')}
                  </Button>
                )}
                <ErrorText error={resend.error} />
              </Stack>
            </Alert>
          )}

          <section>
            <Group gap="xs">
              <Title order={2} size="h4">
                {me.displayName}
              </Title>
              <Badge variant="default">{t(`account.role.${me.role}`)}</Badge>
            </Group>
            <Text c="dimmed">{me.email}</Text>
            <Group gap="md" mt="sm">
              {isAdmin && (
                <Anchor component={Link} to={url.adminUsers()}>
                  {t('nav.users')}
                </Anchor>
              )}
            </Group>
          </section>

          <section>
            <Title order={2} size="h5" mb={4}>
              {t('account.mySongs')}
            </Title>
            {mySongs.length === 0 ? (
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
            )}
          </section>

          <Button
            variant="default"
            w="fit-content"
            loading={logOut.isPending}
            onClick={() => logOut.mutate()}
          >
            {t('account.logOut')}
          </Button>
        </Stack>
      </Page>
    </>
  );
}
