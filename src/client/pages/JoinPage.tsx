import { Button, Center, Group, Loader, Stack, Text } from '@mantine/core';
import { useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ErrorText } from '../components/ErrorText.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { putPlaylist } from '../data/catalog.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';

/**
 * /join/:token, an invite link. Says whose playlist it is; signed in, joins at once and opens
 * it; signed out, offers logging in or signing up, both of which come back here.
 */
export function JoinPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const token = useParams().token ?? '';
  const { me, known } = useMe();
  const preview = trpc.playlists.invitePreview.useQuery({ token }, { retry: false });
  const join = trpc.playlists.join.useMutation({
    onSuccess: (playlist) => {
      putPlaylist(playlist.id, playlist);
      navigate(url.playlist(playlist), { replace: true });
    },
  });
  // Once per visit: a token is used up on nothing, but a join should not fire twice.
  const asked = useRef(false);
  useEffect(() => {
    if (me && preview.isSuccess && !asked.current) {
      asked.current = true;
      join.mutate({ token });
    }
  }, [me, preview.isSuccess, join, token]);

  const here = url.join(token);
  return (
    <>
      <PageHeader
        title={t('join.title')}
        backTo={url.home()}
        backLabel={t('nav.backHome')}
      />
      <Page>
        <Stack maw={460} mx="auto" gap="md">
          {preview.error ? (
            <ErrorText error={preview.error} />
          ) : !preview.data || !known ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : (
            <>
              <Text size="lg">
                {t('join.intro', {
                  owner: preview.data.ownerName,
                  name: preview.data.name,
                })}
              </Text>
              {me ? (
                join.error ? (
                  <ErrorText error={join.error} />
                ) : (
                  <Group gap="sm">
                    <Loader size="sm" />
                    <Text c="dimmed">{t('join.joining')}</Text>
                  </Group>
                )
              ) : (
                <>
                  <Text c="dimmed">{t('join.signIn')}</Text>
                  <Group gap="sm">
                    <Button component={Link} to={url.logIn(here)}>
                      {t('auth.logIn')}
                    </Button>
                    <Button component={Link} to={url.signUp(here)} variant="default">
                      {t('auth.signUp')}
                    </Button>
                  </Group>
                </>
              )}
            </>
          )}
        </Stack>
      </Page>
    </>
  );
}
