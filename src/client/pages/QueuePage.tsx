import { Badge, Stack, Tabs, Text, UnstyledButton } from '@mantine/core';
import { Navigate, Link, useSearchParams } from 'react-router';
import { ErrorText } from '../components/ErrorText.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { useCatalog } from '../data/catalog.ts';
import { reviewContext } from '../data/reviewContext.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { url } from '#shared/urls.ts';
import rowClasses from '../components/SongRow.module.css';
import { PageLoader } from '../components/PageLoader.tsx';

type Status = 'pending' | 'rejected';

export function QueuePage() {
  const i18n = useI18n();
  const { t, formatDate } = i18n;
  const { isEditor, known } = useMe();
  const { playlists } = useCatalog();
  const [params, setParams] = useSearchParams();
  const status: Status = params.get('status') === 'rejected' ? 'rejected' : 'pending';
  const queue = trpc.songs.queue.useQuery({ status }, { enabled: isEditor });
  const pendingCount = trpc.songs.queue.useQuery(
    { status: 'pending' },
    { enabled: isEditor },
  );

  if (!known) {
    // Not the tabs for a moment, then away: wait to know who this is.
    return <PageLoader full />;
  }
  if (!isEditor) {
    return <Navigate to={url.home()} replace />;
  }

  return (
    <>
      <PageHeader
        title={t('queue.title')}
        backTo={url.home()}
        backLabel={t('nav.backHome')}
      />
      <Page>
        <Tabs
          value={status}
          onChange={(v) =>
            setParams(v === 'rejected' ? { status: v } : {}, { replace: true })
          }
        >
          <Tabs.List mb="sm">
            <Tabs.Tab
              value="pending"
              rightSection={
                pendingCount.data?.length ? (
                  <Badge size="sm" variant="filled" color="orange" circle>
                    {pendingCount.data.length}
                  </Badge>
                ) : null
              }
            >
              {t('queue.pending')}
            </Tabs.Tab>
            <Tabs.Tab value="rejected">{t('queue.rejected')}</Tabs.Tab>
          </Tabs.List>
        </Tabs>
        <ErrorText error={queue.error} />
        {queue.isLoading ? (
          <PageLoader />
        ) : queue.data?.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {t('queue.empty')}
          </Text>
        ) : (
          <Stack gap={0} mx="-md">
            {queue.data?.map((song) => (
              <UnstyledButton
                key={song.id}
                component={Link}
                to={url.review(song.id)}
                className={rowClasses.row}
              >
                <Text fw={600} truncate>
                  {song.title}
                </Text>
                <Text size="sm" c="dimmed" truncate>
                  {[
                    song.artist,
                    status === 'pending'
                      ? song.authorName && t('queue.addedBy', { name: song.authorName })
                      : [
                          song.rejectionReason && t(`reason.${song.rejectionReason}`),
                          song.reviewerName &&
                            t('queue.rejectedBy', { name: song.reviewerName }),
                        ]
                          .filter(Boolean)
                          .join(', '),
                    formatDate(status === 'pending' ? song.createdAt : song.updatedAt),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {status === 'pending' && (
                  <Context
                    parts={reviewContext(
                      song.id,
                      song.lastRejection,
                      playlists.values(),
                      i18n,
                    )}
                  />
                )}
              </UnstyledButton>
            ))}
          </Stack>
        )}
      </Page>
    </>
  );
}

/** Why a song is worth reviewing soon: shown, not dimmed, so it stands out in the list. */
function Context({ parts }: { parts: string[] }) {
  return parts.length > 0 ? (
    <Text size="sm" fw={500} truncate>
      {parts.join(' · ')}
    </Text>
  ) : null;
}
