import {
  Box,
  Checkbox,
  Group,
  SegmentedControl,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { IconArrowRight, IconNote, IconPlaylist } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { url } from '#shared/urls.ts';
import { IconButton } from '../components/IconButton.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { PageLoader } from '../components/PageLoader.tsx';
import { SongRow, type SongLinkState } from '../components/SongRow.tsx';
import { useCatalog, type LocalNote } from '../data/catalog.ts';
import { notifyIfQueued } from '../data/offline.ts';
import { canChangeNote, inFilter, notesBy, type NoteFilter } from '../data/notes.ts';
import type { NoteRecord, PlaylistRecord } from '../data/store.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { NoteModal, useNoteRequests } from '../song/NoteModal.tsx';

/**
 * Notes by song, in the order of each song's newest note: the songs with the latest notes
 * first, each song's notes newest first (as `notes` come).
 */
function bySong(notes: LocalNote[]): [number, LocalNote[]][] {
  const songs = new Map<number, LocalNote[]>();
  for (const note of notes) {
    songs.set(note.songId, [...(songs.get(note.songId) ?? []), note]);
  }
  return [...songs];
}

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
 * /notes, "Moje poznámky": every note the viewer wrote, their own and for playlists, by song,
 * the latest first (D135), to find a TODO again, tick it, fix it, or prune. Each opens to be
 * changed right here, and leads to its place in the song.
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

  const requests = useNoteRequests();
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
                <Stack gap="lg">
                  {bySong(shown).map(([songId, notes]) => {
                    const song = songs.get(songId);
                    return (
                      song && (
                        <section key={songId}>
                          {/* The song once, a heading leading to it; its notes under it. */}
                          <Box mx="-md">
                            <SongRow song={song} to={url.song(song)} linkState={back} />
                          </Box>
                          <Stack gap={4} mt={2}>
                            {notes.map((note) => {
                              const playlist =
                                note.playlistId === null
                                  ? undefined
                                  : playlists.get(note.playlistId);
                              return (
                                <NoteRow
                                  key={note.id}
                                  note={note}
                                  playlist={playlist}
                                  canChange={canChangeNote(
                                    note,
                                    playlist,
                                    me.emailVerified,
                                  )}
                                  to={noteLink(note, playlist, url.song(song))}
                                  linkState={{ ...back, note: note.id }}
                                  onOpen={() => setEditing(note)}
                                  onDone={(done) => {
                                    requests.update.mutate({
                                      id: note.id,
                                      text: note.text,
                                      todo: true,
                                      done,
                                    });
                                    notifyIfQueued(t('common.savesWhenOnline'));
                                  }}
                                />
                              );
                            })}
                          </Stack>
                        </section>
                      )
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

/**
 * One note under its song: a TODO's checkbox (one tap, done), what it says (a tap opens it to
 * change it), where in the song and whose, and the way to it in the song.
 */
function NoteRow({
  note,
  playlist,
  canChange,
  to,
  linkState,
  onOpen,
  onDone,
}: {
  note: LocalNote;
  playlist: PlaylistRecord | undefined;
  canChange: boolean;
  to: string;
  linkState: SongLinkState;
  onOpen: () => void;
  onDone: (done: boolean) => void;
}) {
  const { t } = useI18n();
  const done = note.doneAt !== null;
  const text = (
    <Text
      size="sm"
      td={done ? 'line-through' : undefined}
      style={{ whiteSpace: 'pre-line' }}
    >
      {note.text}
      {note.waiting && (
        <Text span size="xs" c="dimmed">
          {' · '}
          {t('notes.waiting')}
        </Text>
      )}
    </Text>
  );
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      {/* One width whatever leads, so the notes' text lines up. */}
      <Box w={20} style={{ flex: 'none' }}>
        {note.todo ? (
          <Checkbox
            mt={2}
            checked={done}
            disabled={!canChange}
            aria-label={t('notes.doneOf', { text: note.text })}
            onChange={(e) => onDone(e.currentTarget.checked)}
          />
        ) : note.playlistId !== null ? (
          <IconPlaylist size={18} role="img" aria-label={t('notes.playlistMark')} />
        ) : (
          <IconNote size={18} role="img" aria-label={t('notes.mark')} />
        )}
      </Box>
      <Stack gap={2} flex={1} miw={0}>
        {canChange ? (
          <UnstyledButton
            onClick={onOpen}
            aria-label={t('notes.changeOf', { text: note.text })}
          >
            {text}
          </UnstyledButton>
        ) : (
          text
        )}
        <Text size="xs" c="dimmed" lineClamp={1}>
          {note.line
            ? t('notes.atLine', { words: note.line.text })
            : t('notes.wholeSong')}
        </Text>
        {/* A row of its own: the line's words may be long, the playlist's name must show. */}
        {playlist && (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {t('notes.forPlaylist', { name: playlist.name })}
          </Text>
        )}
      </Stack>
      <IconButton label={t('notes.showInSong')} to={to} state={linkState}>
        <IconArrowRight size={18} />
      </IconButton>
    </Group>
  );
}
