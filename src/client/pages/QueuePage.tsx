import { Badge, Stack, Tabs, Text, UnstyledButton } from '@mantine/core';
import { Navigate, Link, useSearchParams } from 'react-router';
import { ErrorText } from '../components/ErrorText.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { useMemo } from 'react';
import type { SongLinkState } from '../components/SongRow.tsx';
import { useCatalog, type LocalNote } from '../data/catalog.ts';
import { openReports } from '../data/notes.ts';
import { reviewContext } from '../data/reviewContext.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { url } from '#shared/urls.ts';
import rowClasses from '../components/SongRow.module.css';
import { PageLoader } from '../components/PageLoader.tsx';

type Status = 'pending' | 'rejected' | 'reports';

export function QueuePage() {
  const { t } = useI18n();
  const { isEditor, known } = useMe();
  const { notes, songs } = useCatalog();
  const [params, setParams] = useSearchParams();
  const asked = params.get('status');
  const status: Status = asked === 'rejected' || asked === 'reports' ? asked : 'pending';
  const reports = useMemo(() => openReports(notes, songs), [notes, songs]);
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
            setParams(v === 'rejected' || v === 'reports' ? { status: v } : {}, {
              replace: true,
            })
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
            {/* A tab per kind of thing waiting for an editor (D143). */}
            <Tabs.Tab
              value="reports"
              rightSection={
                reports.length > 0 ? (
                  <Badge size="sm" variant="filled" color="orange" circle>
                    {reports.length}
                  </Badge>
                ) : null
              }
            >
              {t('queue.reports')}
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
        {status === 'reports' ? (
          <ReportList reports={reports} />
        ) : (
          <SongQueue status={status} />
        )}
      </Page>
    </>
  );
}

/** The songs waiting, or rejected: from the server, which keeps the history (D86). */
function SongQueue({ status }: { status: 'pending' | 'rejected' }) {
  const i18n = useI18n();
  const { t, formatDate } = i18n;
  const { playlists } = useCatalog();
  const queue = trpc.songs.queue.useQuery({ status });
  return (
    <>
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
    </>
  );
}

/**
 * The reports of mistakes by song (D144): the song with the oldest one first, its reports under
 * its title, each with what, where, who and when, leading to its place in the song, where it's
 * fixed and resolved.
 */
function ReportList({ reports }: { reports: LocalNote[] }) {
  const { t, formatDate } = useI18n();
  const { songs } = useCatalog();
  const back = { backTo: url.queue('reports'), backName: t('queue.title') };
  // In the order of each song's oldest report: `reports` come oldest first.
  const bySong = new Map<number, LocalNote[]>();
  for (const report of reports) {
    bySong.set(report.songId, [...(bySong.get(report.songId) ?? []), report]);
  }
  if (bySong.size === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        {t('queue.noReports')}
      </Text>
    );
  }
  return (
    <Stack gap="md">
      {[...bySong].map(([songId, list]) => {
        const song = songs.get(songId);
        return (
          song && (
            <section key={songId}>
              <Text fw={600} truncate>
                {song.title}
              </Text>
              <Stack gap={0} mx="-md">
                {list.map((report) => (
                  <UnstyledButton
                    key={report.id}
                    component={Link}
                    to={url.song(song)}
                    state={{ ...back, note: report.id } satisfies SongLinkState}
                    className={rowClasses.row}
                  >
                    <Text size="sm" lineClamp={3} style={{ whiteSpace: 'pre-line' }}>
                      {report.text}
                    </Text>
                    {/* Where, then who and when, a line each: on a phone the line's words
                        would push who reported it out of sight. */}
                    <Text size="sm" c="dimmed" truncate>
                      {report.line
                        ? t('notes.atLine', { words: report.line.text })
                        : t('notes.wholeSong')}
                    </Text>
                    <Text size="sm" c="dimmed" truncate>
                      {`${t('notes.reportedBy', { name: report.authorName })} · ${formatDate(report.createdAt)}`}
                    </Text>
                  </UnstyledButton>
                ))}
              </Stack>
            </section>
          )
        );
      })}
    </Stack>
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
