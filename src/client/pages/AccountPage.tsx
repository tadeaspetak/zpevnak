import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Title,
  useMantineColorScheme,
  type MantineColorScheme,
} from '@mantine/core';
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
import type { Locale } from '#shared/validators/index.ts';

export function AccountPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { me, isEditor, isAdmin, known } = useMe();
  const { songs } = useCatalog();
  const mySongs = useMemo(
    () =>
      me
        ? sortByTitle(
            [...songs.values()].filter((s) => s.createdBy === me.id),
            locale,
          )
        : [],
    [songs, me, locale],
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
                    variant="light"
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
              <Badge variant="light">{t(`account.role.${me.role}`)}</Badge>
            </Group>
            <Text c="dimmed">{me.email}</Text>
            <Group gap="md" mt="sm">
              {isEditor && (
                <Anchor component={Link} to={url.queue()}>
                  {t('nav.queue')}
                </Anchor>
              )}
              {isAdmin && (
                <Anchor component={Link} to={url.adminUsers()}>
                  {t('nav.users')}
                </Anchor>
              )}
            </Group>
          </section>

          <Settings />

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

/** Language and theme. Per device; signed-out visitors get them from the home page footer. */
export function Settings() {
  const { t, locale, setLocale } = useI18n();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <section>
      <Title order={2} size="h5" mb="xs">
        {t('account.settings')}
      </Title>
      <Stack gap="sm">
        <div>
          <Text size="sm" fw={500} mb={4}>
            {t('account.language')}
          </Text>
          <SegmentedControl
            value={locale}
            onChange={(v) => setLocale(v as Locale)}
            data={[
              { value: 'cs', label: 'Čeština' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
        <div>
          <Text size="sm" fw={500} mb={4}>
            {t('account.theme')}
          </Text>
          <SegmentedControl
            value={colorScheme}
            onChange={(v) => setColorScheme(v as MantineColorScheme)}
            data={[
              { value: 'auto', label: t('account.themeAuto') },
              { value: 'light', label: t('account.themeLight') },
              { value: 'dark', label: t('account.themeDark') },
            ]}
          />
        </div>
      </Stack>
    </section>
  );
}
