import { Badge, Center, Loader, Stack, Tabs, Text, UnstyledButton } from '@mantine/core';
import { Navigate, Link, useSearchParams } from 'react-router';
import { ErrorText } from '../components/ErrorText.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { useBack } from '../hooks/useBack.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';
import rowClasses from '../components/SongRow.module.css';

type Status = 'pending' | 'rejected';

export function QueuePage() {
  const { t, locale } = useI18n();
  const { isEditor, known } = useMe();
  const back = useBack({ to: url.home(), label: t('nav.backHome') });
  const [params, setParams] = useSearchParams();
  const status: Status = params.get('status') === 'rejected' ? 'rejected' : 'pending';
  const queue = trpc.songs.queue.useQuery({ status }, { enabled: isEditor });
  const pendingCount = trpc.songs.queue.useQuery(
    { status: 'pending' },
    { enabled: isEditor },
  );

  if (known && !isEditor) {
    return <Navigate to={url.home()} replace />;
  }
  const date = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      <PageHeader title={t('queue.title')} backTo={back.to} backLabel={back.label} />
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
                  <Badge size="sm" variant="light" circle>
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
          <Center py="xl">
            <Loader size="sm" />
          </Center>
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
                    date.format(
                      new Date(status === 'pending' ? song.createdAt : song.updatedAt),
                    ),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </UnstyledButton>
            ))}
          </Stack>
        )}
      </Page>
    </>
  );
}
