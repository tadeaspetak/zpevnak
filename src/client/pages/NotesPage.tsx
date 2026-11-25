import { Box, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { IconEdit, IconPlaylist, IconSquare, IconSquareCheck } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { url } from '#shared/urls.ts';
import { IconButton } from '../components/IconButton.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { PageLoader } from '../components/PageLoader.tsx';
import { SongRow, type SongLinkState } from '../components/SongRow.tsx';
import { useCatalog } from '../data/catalog.ts';
import { canChangeNote, inFilter, notesBy, type NoteFilter } from '../data/notes.ts';
import type { NoteRecord, PlaylistRecord } from '../data/store.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { NoteModal } from '../song/NoteModal.tsx';

/** Where a note is read: its song, in the playlist it's for, scrolled to the note. */
function noteLink(
  note: NoteRecord,
  playlist: PlaylistRecord | undefined,
  songUrl: string,
) {
  const position = playlist ? playlist.songIds.indexOf(note.songId) + 1 : 0;
  return playlist && position > 0 ? url.playlistSong(playlist, position) : songUrl;
}

/**
 * /notes, "Moje poznámky": every note the viewer wrote, their own and for playlists, newest
 * first (D135), to find a TODO again, fix it, or prune. Each leads to its place in the song, and
 * opens to be changed right here.
 */
export function NotesPage() {
  const { t } = useI18n();
  const { me, known } = useMe();
  const { notes, songs, playlists, loaded } = useCatalog();
  // The filter is in the address, so back and reload keep it.
  const [params, setParams] = useSearchParams();
  const asked = params.get('filter');
  const filter: NoteFilter = asked === 'todo' || asked === 'done' ? asked : 'all';
  const [editing, setEditing] = useState<NoteRecord | null>(null);

  const mine = useMemo(() => notesBy(notes, songs, me?.id), [notes, songs, me?.id]);
  const shown = mine.filter((n) => inFilter(n, filter));

  if (known && !me) {
    return <Navigate to={url.logIn(url.notes())} replace />;
  }
  if (!me || !loaded) {
    return <PageLoader full />;
  }

  const back: SongLinkState = {
    backTo: url.notes(filter === 'all' ? undefined : filter),
    backName: t('notes.title'),
  };
  return (
    <>
      <PageHeader
        title={t('notes.title')}
        backTo={url.account()}
        backLabel={t('nav.backTo', { name: t('account.title') })}
      />
      <Page>
        <Stack gap="md">
          {mine.length === 0 ? (
            // Only those who may write notes are taught how (D135): a new account confirms
            // its email first.
            <Text c="dimmed">
              {me.emailVerified ? t('notes.none') : t('notes.noneUnverified')}
            </Text>
          ) : (
            <>
              <SegmentedControl
                aria-label={t('notes.filter')}
                value={filter}
                onChange={(v) =>
                  setParams(v === 'all' ? {} : { filter: v }, { replace: true })
                }
                data={[
                  { value: 'all', label: t('notes.filter.all') },
                  { value: 'todo', label: t('notes.filter.todo') },
                  { value: 'done', label: t('notes.filter.done') },
                ]}
              />
              {shown.length === 0 ? (
                <Text c="dimmed">
                  {t(`notes.none.${filter === 'done' ? 'done' : 'todo'}`)}
                </Text>
              ) : (
                <Stack gap={0} mx="-md">
                  {shown.map((note) => {
                    const song = songs.get(note.songId);
                    if (!song) {
                      return null;
                    }
                    const playlist =
                      note.playlistId === null
                        ? undefined
                        : playlists.get(note.playlistId);
                    return (
                      <Group
                        key={note.id}
                        gap={0}
                        wrap="nowrap"
                        align="flex-start"
                        pr="md"
                      >
                        <Box flex={1} miw={0}>
                          <SongRow
                            song={song}
                            to={noteLink(note, playlist, url.song(song))}
                            linkState={{ ...back, note: note.id }}
                            detail={<NoteDetail note={note} playlist={playlist} />}
                          />
                        </Box>
                        {canChangeNote(note, playlist, me.emailVerified) && (
                          <IconButton
                            label={t('notes.change')}
                            mt="xs"
                            onClick={() => setEditing(note)}
                          >
                            <IconEdit size={18} />
                          </IconButton>
                        )}
                      </Group>
                    );
                  })}
                </Stack>
              )}
            </>
          )}
        </Stack>
      </Page>
      <NoteModal
        target={editing && { kind: 'edit', note: editing }}
        playlist={null}
        showSong
        onClose={() => setEditing(null)}
      />
    </>
  );
}

/** The note under its song: what it says, where in the song, and whose it is. */
function NoteDetail({
  note,
  playlist,
}: {
  note: NoteRecord;
  playlist: PlaylistRecord | undefined;
}) {
  const { t } = useI18n();
  const mark = note.todo ? (
    note.doneAt ? (
      <IconSquareCheck size={14} role="img" aria-label={t('notes.doneMark')} />
    ) : (
      <IconSquare size={14} role="img" aria-label={t('notes.todoMark')} />
    )
  ) : null;
  return (
    <Stack gap={2} mt={4}>
      <Group gap={6} wrap="nowrap" align="flex-start">
        {mark}
        <Text
          size="sm"
          td={note.doneAt ? 'line-through' : undefined}
          style={{ whiteSpace: 'pre-line' }}
        >
          {note.text}
        </Text>
      </Group>
      <Text size="xs" c="dimmed" lineClamp={1}>
        {note.line ? t('notes.atLine', { words: note.line.text }) : t('notes.wholeSong')}
      </Text>
      {playlist && (
        <Group gap={4} wrap="nowrap">
          <IconPlaylist size={14} color="var(--mantine-color-dimmed)" />
          <Text size="xs" c="dimmed" lineClamp={1}>
            {t('notes.forPlaylist', { name: playlist.name })}
          </Text>
        </Group>
      )}
    </Stack>
  );
}
