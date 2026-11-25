import {
  Box,
  Checkbox,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  UnstyledButton,
} from '@mantine/core';
import { IconArrowRight, IconNote, IconPlaylist, IconTrash } from '@tabler/icons-react';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Me } from '#server/auth/me.ts';
import { url } from '#shared/urls.ts';
import { NOTE_TEXT_MAX } from '#shared/validators/index.ts';
import { useCatalog, type LocalNote } from '../data/catalog.ts';
import { notifyIfQueued } from '../data/offline.ts';
import { canChangeNote, inFilter, notesBy, type NoteFilter } from '../data/notes.ts';
import type { NoteRecord, PlaylistRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';
import { useNoteRequests } from '../song/NoteModal.tsx';
import { IconButton } from './IconButton.tsx';
import { PageLoader } from './PageLoader.tsx';
import { SongRow, type SongLinkState } from './SongRow.tsx';

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

type NoteRequests = ReturnType<typeof useNoteRequests>;

/**
 * "Moje poznámky", the account's tab (D139): every note the viewer wrote, their own and for
 * playlists, by song, the latest first (D135, D138), to find a TODO again, tick it, fix it, or
 * prune. Each is changed and deleted right in the list, and leads to its place in the song.
 */
export function NotesList({ me }: { me: Me }) {
  const { t } = useI18n();
  const { notes, songs, playlists, loaded } = useCatalog();
  // The filter is in the address, beside the tab, so back and reload keep it.
  const [params, setParams] = useSearchParams();
  const asked = params.get('filter');
  const filter: NoteFilter = asked === 'todo' || asked === 'done' ? asked : 'all';
  const requests = useNoteRequests();
  const mine = useMemo(() => notesBy(notes, songs, me.id), [notes, songs, me.id]);
  const shown = mine.filter((n) => inFilter(n, filter));

  if (!loaded) {
    return <PageLoader />;
  }
  if (mine.length === 0) {
    // Only those who may write notes are taught how (D135): a new account confirms its email
    // first.
    return (
      <Text c="dimmed">
        {me.emailVerified ? t('notes.none') : t('notes.noneUnverified')}
      </Text>
    );
  }

  const back: SongLinkState = {
    backTo: url.notes(filter === 'all' ? undefined : filter),
    backName: t('notes.title'),
  };
  return (
    <Stack gap="md">
      <SegmentedControl
        aria-label={t('notes.filter')}
        value={filter}
        onChange={(v) =>
          setParams(
            (was) => {
              const next = new URLSearchParams(was);
              if (v === 'all') {
                next.delete('filter');
              } else {
                next.set('filter', v);
              }
              return next;
            },
            { replace: true },
          )
        }
        data={[
          { value: 'all', label: t('notes.filter.all') },
          { value: 'todo', label: t('notes.filter.todo') },
          { value: 'done', label: t('notes.filter.done') },
        ]}
      />
      {shown.length === 0 ? (
        <Text c="dimmed">{t(`notes.none.${filter === 'done' ? 'done' : 'todo'}`)}</Text>
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
                  <Stack gap={6} mt={2}>
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
                          canChange={canChangeNote(note, playlist, me.emailVerified)}
                          to={noteLink(note, playlist, url.song(song))}
                          linkState={{ ...back, note: note.id }}
                          requests={requests}
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
    </Stack>
  );
}

/**
 * One note under its song: a TODO's checkbox (one tap, done), what it says (a tap turns it into
 * a field to change it in place: Enter or leaving it saves, Escape doesn't), where in the song
 * and for whom, a bin (deleted at once, an undo in the toast), and the way to it in the song.
 */
function NoteRow({
  note,
  playlist,
  canChange,
  to,
  linkState,
  requests,
}: {
  note: LocalNote;
  playlist: PlaylistRecord | undefined;
  canChange: boolean;
  to: string;
  linkState: SongLinkState;
  requests: NoteRequests;
}) {
  const { t } = useI18n();
  const done = note.doneAt !== null;
  // What is being typed, while the note is open in place.
  const [draft, setDraft] = useState<string | null>(null);
  // What was saved, shown until its request ends: online, the catalog changes only then.
  // Refused, the note is as the server has it again (and the toast says why).
  const [sent, setSent] = useState<string | null>(null);
  const text = sent ?? note.text;

  const save = (next: { text?: string; done?: boolean }) => {
    const request = requests.update.mutateAsync({
      id: note.id,
      text: next.text ?? note.text,
      todo: note.todo,
      done: next.done ?? done,
    });
    notifyIfQueued(t('common.savesWhenOnline'));
    return request;
  };
  // Enter, then the blur of the field going away, both ask to save: once is enough.
  const open = useRef(false);
  const edit = () => {
    open.current = true;
    setDraft(note.text);
  };
  const close = () => {
    open.current = false;
    setDraft(null);
  };
  const commit = () => {
    if (!open.current || draft === null) {
      return;
    }
    close();
    const typed = draft.trim();
    // Emptied, it stays as it was: deleting is the bin's, one tap away and undoable.
    if (typed && typed !== note.text) {
      setSent(typed);
      save({ text: typed })
        // The error is the toast's (`useNoteRequests`).
        .catch(() => undefined)
        .finally(() => setSent(null));
    }
  };

  const shownText = (
    <Text
      size="sm"
      td={done ? 'line-through' : undefined}
      style={{ whiteSpace: 'pre-line' }}
    >
      {text}
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
      <Box w={20} pt={2} style={{ flex: 'none' }}>
        {note.todo ? (
          <Checkbox
            checked={done}
            disabled={!canChange}
            aria-label={t('notes.doneOf', { text: note.text })}
            onChange={(e) =>
              void save({ done: e.currentTarget.checked }).catch(() => undefined)
            }
          />
        ) : note.playlistId !== null ? (
          <IconPlaylist size={18} role="img" aria-label={t('notes.playlistMark')} />
        ) : (
          <IconNote size={18} role="img" aria-label={t('notes.mark')} />
        )}
      </Box>
      <Stack gap={2} flex={1} miw={0}>
        {draft !== null ? (
          <Textarea
            aria-label={t('notes.text')}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              // Enter saves, as in a chat; Shift+Enter is a new line.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                // Only the field: the page's own Escape isn't for this.
                e.stopPropagation();
                close();
              }
            }}
            autosize
            minRows={1}
            maxLength={NOTE_TEXT_MAX}
            size="sm"
            autoFocus
            onFocus={(e) => {
              // The cursor at the end, where a note is added to.
              const end = e.currentTarget.value.length;
              e.currentTarget.setSelectionRange(end, end);
            }}
          />
        ) : canChange ? (
          <UnstyledButton
            onClick={edit}
            aria-label={t('notes.changeOf', { text: note.text })}
          >
            {shownText}
          </UnstyledButton>
        ) : (
          shownText
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
      <Group gap={0} wrap="nowrap" style={{ flex: 'none' }}>
        {canChange && (
          <IconButton
            label={t('notes.deleteOf', { text: note.text })}
            tooltip={t('common.delete')}
            onClick={() => requests.deleteWithUndo(note)}
          >
            <IconTrash size={18} />
          </IconButton>
        )}
        <IconButton label={t('notes.showInSong')} to={to} state={linkState}>
          <IconArrowRight size={18} />
        </IconButton>
      </Group>
    </Group>
  );
}
