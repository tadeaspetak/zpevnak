import { Anchor, Button, Group, Loader, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ErrorText } from '../components/ErrorText.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { putShared } from '../data/catalog.ts';
import { touchPlaylist } from '../data/session.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { url } from '#shared/urls.ts';
import { PageLoader } from '../components/PageLoader.tsx';

/**
 * /join/:token, an invite link to a playlist or a private song. Says whose it is and what joining
 * lets the reader do; signed in, joins at once and opens it; signed out, offers logging in or
 * signing up, both of which come back here.
 */
export function JoinPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const token = useParams().token ?? '';
  const { me, known } = useMe();
  const preview = trpc.sharing.invitePreview.useQuery({ token }, { retry: false });
  const join = trpc.sharing.join.useMutation({
    onSuccess: (shared) => {
      putShared(shared);
      if (shared.kind === 'playlist') {
        touchPlaylist(shared.playlist.id);
        notifications.show({
          message: t('playlists.joined', { name: shared.playlist.name }),
        });
        navigate(url.playlist(shared.playlist), { replace: true });
      } else {
        notifications.show({ message: t('songs.joined', { name: shared.song.title }) });
        navigate(url.song(shared.song), { replace: true });
      }
    },
  });
  // Once per visit: a token is used up on nothing, but a join should not fire twice. Only once
  // the server has said who is signed in: the device's last answer may be an expired session.
  const asked = useRef(false);
  useEffect(() => {
    if (me && known && preview.isSuccess && !asked.current) {
      asked.current = true;
      join.mutate({ token });
    }
  }, [me, known, preview.isSuccess, join, token]);

  const here = url.join(token);
  const isSong = preview.data?.kind === 'song';
  // A public one can be looked at without joining.
  const publicId = preview.data?.publicId ?? null;
  const name = preview.data?.name ?? '';
  const lookTo =
    publicId === null
      ? null
      : isSong
        ? url.song({ id: publicId, title: name, artist: null })
        : url.playlist({ id: publicId, name });
  return (
    <>
      <PageHeader
        title={isSong ? t('join.titleSong') : t('join.title')}
        backTo={url.home()}
        backLabel={t('nav.backHome')}
      />
      <Page>
        <Stack maw={460} mx="auto" gap="md">
          {preview.error ? (
            <ErrorText error={preview.error} />
          ) : !preview.data || !known ? (
            <PageLoader />
          ) : (
            <>
              <Text size="lg">
                {t(isSong ? 'join.introSong' : 'join.intro', {
                  owner: preview.data.ownerName,
                  name: preview.data.name,
                })}
              </Text>
              {/* Which link it is: the same invite reads alike, and does different things. */}
              <Text>
                {preview.data.role === 'collaborator'
                  ? t(isSong ? 'join.asCollaboratorSong' : 'join.asCollaborator')
                  : t(isSong ? 'join.asViewerSong' : 'join.asViewer')}
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
                    {/* Someone opening an invite is most likely new here. */}
                    <Button component={Link} to={url.signUp(here)}>
                      {t('auth.signUp')}
                    </Button>
                    <Button component={Link} to={url.logIn(here)} variant="default">
                      {t('auth.logIn')}
                    </Button>
                  </Group>
                  {lookTo && (
                    <Anchor component={Link} to={lookTo} size="sm">
                      {t('playlists.justLook')}
                    </Anchor>
                  )}
                </>
              )}
            </>
          )}
        </Stack>
      </Page>
    </>
  );
}
