import { Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconFlag } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useCatalog } from '../data/catalog.ts';
import { openReports } from '../data/notes.ts';
import { useI18n } from '../i18n/index.tsx';
import { useNoteRequests } from '../song/NoteModal.tsx';

/**
 * The song's open reports where it's fixed, above its text in the editor (D146): what, where,
 * who and when, each resolved there once fixed ("Vyřešeno", undone from the toast, D139).
 * Nothing when there are none.
 */
export function SongReports({ songId }: { songId: number }) {
  const { t, formatDate } = useI18n();
  const { notes, songs } = useCatalog();
  const requests = useNoteRequests();
  const reports = useMemo(
    () => openReports(notes, songs).filter((n) => n.songId === songId),
    [notes, songs, songId],
  );
  if (reports.length === 0) {
    return null;
  }
  return (
    <Paper withBorder p="sm" radius="md" component="section">
      <Title order={2} size="h6" mb="xs">
        <Group gap={6} component="span">
          <IconFlag size={16} aria-hidden />
          {t('notes.reportsHere', { count: reports.length })}
        </Group>
      </Title>
      <Stack gap="sm">
        {reports.map((report) => (
          <Group key={report.id} justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={2} miw={0}>
              <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
                {report.text}
              </Text>
              {/* Where, then who and when, a line each, as in the queue (D144). */}
              <Text size="xs" c="dimmed">
                {report.line
                  ? t('notes.atLine', { words: report.line.text })
                  : t('notes.wholeSong')}
              </Text>
              <Text size="xs" c="dimmed">
                {`${t('notes.reportedBy', { name: report.authorName })} · ${formatDate(report.createdAt)}`}
              </Text>
            </Stack>
            <Button
              size="sm"
              variant="default"
              style={{ flex: 'none' }}
              onClick={() => requests.resolveWithUndo(report)}
            >
              {t('notes.resolve')}
            </Button>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}
