import {
  Button,
  Checkbox,
  Group,
  Modal,
  Radio,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import type { NotePlace } from '#shared/notes.ts';
import { NOTE_TEXT_MAX } from '#shared/validators/index.ts';
import {
  addComment,
  commentText,
  removeComment,
  replaceComment,
} from '#shared/chordpro/comments.ts';
import { putNote, putSong, settleNote, useCatalog, waitNote } from '../data/catalog.ts';
import { useMe } from '../hooks/useMe.ts';
import { notifyIfQueued } from '../data/offline.ts';
import type { NoteRecord, SongRecord } from '../data/store.ts';
import { showUndoToast } from '../components/UndoToast.tsx';
import { useI18n } from '../i18n/index.tsx';
import { trpc, trpcClient } from '../trpc.ts';

/**
 * What the dialog is about: a new note at a line (null: the whole song), asked for as a report
 * from "Nahlásit chybu" (`report`); one to change; or a report for whoever may fix the song to
 * read and resolve (D143).
 */
export type NoteTarget =
  | { kind: 'new'; songId: number; place: NotePlace | null; report?: boolean }
  | { kind: 'edit'; note: NoteRecord }
  | { kind: 'review'; note: NoteRecord }
  /** The song's own comment on source line `at` (D145), to change or remove. */
  | { kind: 'comment'; at: number; text: string };

/** Whom a new note is for, or, `song`, a comment written into the song itself (D145). */
type Audience = NoteRecord['kind'] | 'song';

type Props = {
  target: NoteTarget | null;
  /** The playlist being played from, where the reader may write its notes (D135). */
  playlist: { id: number; name: string; isPublic: boolean } | null;
  /** The reader may report a mistake in this song (D143). */
  canReport: boolean;
  /**
   * The song, as loaded, for whoever may change it: they resolve reports, their own here too
   * (D143), and write comments into it (D145). Null for anyone else.
   */
  fixing: SongRecord | null;
  onClose: () => void;
  /** After a note is saved. */
  onSaved?: () => void;
};

/**
 * Writing, changing and deleting notes (D135), wherever it's done: the dialog, or right in
 * Moje poznámky (D139). What the server returns goes into the catalog. Offline, a change shows at once,
 * marked as waiting (`waitNote`), until its request ends; online it shows when the server has
 * it, a moment later, rather than flash "waiting". Kept by a component that stays mounted, so
 * a request waiting for the connection still lands.
 */
export function useNoteRequests() {
  const { t, tError } = useI18n();
  const { me } = useMe();
  const { notes } = useCatalog();
  const onError = (error: unknown) =>
    notifications.show({ color: 'red', message: tError(error) });
  const remove = trpc.notes.delete.useMutation({
    onMutate: (input) => {
      if (!navigator.onLine) {
        waitNote(input.id, null);
      }
    },
    onSuccess: (_, { id }) => putNote(id, null),
    onError: (error) => onError(error),
    onSettled: (_result, _error, input) => settleNote(input.id),
  });
  return {
    create: trpc.notes.create.useMutation({
      onMutate: (input) => {
        if (navigator.onLine || !me) {
          return {};
        }
        const now = new Date().toISOString();
        // Below every real id, and apart from any other note waiting.
        const id = -Date.now();
        waitNote(id, {
          id,
          songId: input.songId,
          kind: input.kind,
          playlistId: input.playlistId,
          authorId: me.id,
          authorName: me.displayName,
          text: input.text,
          todo: input.todo,
          doneAt: null,
          line: input.line,
          resolvedAt: null,
          createdAt: now,
          updatedAt: now,
        });
        return { waitingId: id };
      },
      onSuccess: (note) => putNote(note.id, note),
      onError: (error) => onError(error),
      onSettled: (_note, _error, _input, context) => {
        if (context?.waitingId !== undefined) {
          settleNote(context.waitingId);
        }
      },
    }),
    update: trpc.notes.update.useMutation({
      onMutate: (input) => {
        const was = notes.get(input.id);
        if (navigator.onLine || !was) {
          return;
        }
        waitNote(input.id, {
          ...was,
          text: input.text,
          todo: input.todo,
          doneAt:
            input.todo && input.done ? (was.doneAt ?? new Date().toISOString()) : null,
        });
      },
      onSuccess: (note) => putNote(note.id, note),
      onError: (error) => onError(error),
      onSettled: (_note, _error, input) => settleNote(input.id),
    }),
    /** A report fixed (D143): it leaves the song for whoever resolved it. */
    resolve: trpc.notes.resolve.useMutation({
      onSuccess: (_, { id }) => {
        putNote(id, null);
        notifications.show({ message: t('notes.resolvedDone') });
      },
      onError: (error) => onError(error),
    }),
    /**
     * Deleted at once, taken back by one tap (D139): the note goes from sight while the toast
     * says so, and the request is sent only when the toast closes without an undo. Closed with
     * the app before then, the note is still there.
     */
    deleteWithUndo: (note: NoteRecord) => {
      waitNote(note.id, null);
      showUndoToast({
        id: `note-deleted-${note.id}`,
        message: t('notes.deleted'),
        onUndo: async () => settleNote(note.id),
        onKept: () => {
          remove.mutate({ id: note.id });
          notifyIfQueued(t('common.savesWhenOnline'));
        },
      });
    },
  };
}

type NoteRequests = ReturnType<typeof useNoteRequests>;

/**
 * A comment written into the song itself (D145): an edit of its ChordPro like any other,
 * against the song as it was loaded (`seenAt`, D106), recorded as a version (D86). What the
 * server returns goes into the catalog.
 */
function useSongComments() {
  const { t, tError } = useI18n();
  const update = trpc.songs.update.useMutation({
    onSuccess: (song) => putSong(song),
    onError: (error) => notifications.show({ color: 'red', message: tError(error) }),
  });
  const save = (song: SongRecord, source: string, then: (saved: SongRecord) => void) => {
    update.mutate({ id: song.id, source, seenAt: song.updatedAt }, { onSuccess: then });
    notifyIfQueued(t('common.savesWhenOnline'));
  };
  return {
    pending: update.isPending,
    save,
    /** Removed at once, and put back by one tap (D139), as a new version again. */
    removeWithUndo: (song: SongRecord, at: number, then: () => void) =>
      save(song, removeComment(song.source, at), (saved) => {
        then();
        showUndoToast({
          id: `comment-removed-${song.id}-${at}`,
          message: t('notes.songCommentRemoved'),
          onUndo: async () => {
            putSong(
              await trpcClient.songs.update.mutate({
                id: song.id,
                source: song.source,
                seenAt: saved.updatedAt,
              }),
            );
          },
        });
      }),
  };
}

type SongComments = ReturnType<typeof useSongComments>;

/**
 * Writing a note on a song, or changing one (D135): its text, who it's for (one's own, the
 * playlist's, or a report for the editors, D143; chosen when it's written), and for one's own,
 * TODO and done. A report also opens here for whoever may fix the song, to resolve it. The
 * requests live here, kept mounted, not in the form: one waiting for the connection (D133)
 * outlives the form, closed meanwhile, and still lands in the catalog, or says why it didn't.
 */
export function NoteModal({ target, ...props }: Props) {
  const { t } = useI18n();
  const requests = useNoteRequests();
  const comments = useSongComments();
  const key =
    target === null
      ? 'closed'
      : target.kind === 'new'
        ? `new-${target.place?.place ?? 'song'}-${target.report ? 'report' : 'note'}`
        : target.kind === 'comment'
          ? `comment-${target.at}`
          : `${target.kind}-${target.note.id}`;
  const title =
    target === null
      ? ''
      : target.kind === 'new'
        ? target.report
          ? t('song.reportMistake')
          : t('notes.new')
        : target.kind === 'comment'
          ? t('notes.songComment')
          : target.note.kind === 'report'
            ? t('notes.report')
            : t('notes.edit');
  // Deleted at once, as in Moje poznámky, taken back from the toast (D139): the dialog closes.
  const deleteNote = (note: NoteRecord) => {
    requests.deleteWithUndo(note);
    props.onClose();
  };
  return (
    <Modal opened={target !== null} onClose={props.onClose} title={title}>
      {target?.kind === 'review' && (
        <ReportReview
          key={key}
          note={target.note}
          resolve={requests.resolve}
          onClose={props.onClose}
        />
      )}
      {target?.kind === 'comment' && props.fixing && (
        <SongCommentForm
          key={key}
          song={props.fixing}
          at={target.at}
          text={target.text}
          comments={comments}
          onClose={props.onClose}
        />
      )}
      {/* A fresh form for each note: nothing typed for one carries over to the next. */}
      {(target?.kind === 'new' || target?.kind === 'edit') && (
        <NoteForm
          key={key}
          target={target}
          requests={requests}
          comments={comments}
          onDelete={deleteNote}
          {...props}
        />
      )}
    </Modal>
  );
}

function NoteForm({
  target,
  playlist,
  canReport,
  fixing,
  onClose,
  onSaved,
  requests: { create, update, resolve },
  comments,
  onDelete,
}: Props & {
  target: Extract<NoteTarget, { kind: 'new' | 'edit' }>;
  requests: NoteRequests;
  comments: SongComments;
  onDelete: (note: NoteRecord) => void;
}) {
  const { t } = useI18n();
  const { playlists } = useCatalog();
  const existing = target.kind === 'edit' ? target.note : null;
  const ownPlaylist =
    existing && existing.playlistId !== null
      ? playlists.get(existing.playlistId)
      : undefined;
  const [text, setText] = useState(existing?.text ?? '');
  const [audience, setAudience] = useState<Audience>(
    existing?.kind ?? (target.kind === 'new' && target.report ? 'report' : 'own'),
  );
  const [todo, setTodo] = useState(existing?.todo ?? false);
  const [done, setDone] = useState(existing !== null && existing.doneAt !== null);

  const words = target.kind === 'edit' ? target.note.line?.text : target.place?.words;
  const isOwn = audience === 'own';
  const choices: Audience[] = [
    'own',
    ...(playlist ? (['playlist'] as const) : []),
    ...(canReport ? (['report'] as const) : []),
    ...(fixing ? (['song'] as const) : []),
  ];
  const saved = (note: NoteRecord) => {
    // Done, it leaves the song: say where it went.
    if (note.doneAt !== null && existing?.doneAt === null) {
      notifications.show({ message: t('notes.doneMoved') });
    }
    onSaved?.();
    onClose();
  };

  const save = () => {
    if (audience === 'song') {
      // Offered only for a new note, to whoever may change the song (`fixing`).
      if (fixing && target.kind === 'new') {
        const source = addComment(fixing.source, target.place?.after ?? null, text);
        comments.save(fixing, source, () => {
          notifications.show({ message: t('notes.songCommentSaved') });
          onClose();
        });
        if (!navigator.onLine) {
          onClose();
        }
      }
      return;
    }
    if (existing) {
      update.mutate(
        {
          id: existing.id,
          text,
          todo: isOwn && todo,
          done: isOwn && todo && done,
        },
        { onSuccess: saved },
      );
    } else if (target.kind === 'new') {
      create.mutate(
        {
          songId: target.songId,
          kind: audience,
          playlistId: audience === 'playlist' && playlist ? playlist.id : null,
          text,
          todo: isOwn && todo,
          line: target.place
            ? { index: target.place.place, text: target.place.words }
            : null,
        },
        { onSuccess: saved },
      );
    }
    // Offline, the change waits for the connection (D133): the dialog doesn't wait with it.
    notifyIfQueued(t('common.savesWhenOnline'));
    if (!navigator.onLine) {
      onClose();
    }
  };

  const busy = create.isPending || update.isPending || comments.pending;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Stack>
        <Text size="sm" c="dimmed" lineClamp={2}>
          {words ? t('notes.atLine', { words }) : t('notes.wholeSong')}
        </Text>
        <Textarea
          label={t('notes.text')}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          autosize
          minRows={2}
          maxLength={NOTE_TEXT_MAX}
          data-autofocus
          required
        />
        {/* Who it's for is chosen once: a private note made the band's, or back, would
            change who has seen it. */}
        {/* The whole name, and who will see it: the one place a private thought could be
            published by mistake. */}
        {!existing && choices.length > 1 && (
          <Radio.Group
            label={t('notes.audience')}
            value={audience}
            onChange={(v) => setAudience(v as Audience)}
          >
            <Stack gap="xs" mt={4}>
              <Radio value="own" label={t('notes.forMe')} />
              {playlist && (
                <Radio
                  value="playlist"
                  label={t('notes.forPlaylist', { name: playlist.name })}
                  description={
                    playlist.isPublic
                      ? t('notes.forPublicPlaylistHint')
                      : t('notes.forPlaylistHint')
                  }
                />
              )}
              {canReport && (
                <Radio
                  value="report"
                  label={t('notes.forEditors')}
                  description={t('notes.forEditorsHint')}
                />
              )}
              {fixing && (
                <Radio
                  value="song"
                  label={t('notes.forSong')}
                  description={t('notes.forSongHint')}
                />
              )}
            </Stack>
          </Radio.Group>
        )}
        {existing?.kind === 'report' && (
          <Text size="sm" c="dimmed">
            {t('notes.forEditors')}
          </Text>
        )}
        {existing && existing.playlistId !== null && (
          <Text size="sm" c="dimmed">
            {[
              ownPlaylist ? t('notes.forPlaylist', { name: ownPlaylist.name }) : null,
              t('notes.byAuthor', { name: existing.authorName }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
        {isOwn && (
          <Group>
            <Checkbox
              label={t('notes.todo')}
              checked={todo}
              onChange={(e) => setTodo(e.currentTarget.checked)}
            />
            {existing && todo && (
              <Checkbox
                label={t('notes.done')}
                checked={done}
                onChange={(e) => setDone(e.currentTarget.checked)}
              />
            )}
          </Group>
        )}
        <Group justify="space-between">
          {existing ? (
            <Group gap="sm">
              <Button variant="default" onClick={() => onDelete(existing)}>
                {t('common.delete')}
              </Button>
              {/* One's own report, by whoever may fix the song: closed here once fixed. */}
              {existing.kind === 'report' && fixing && (
                <Button
                  variant="default"
                  loading={resolve.isPending}
                  onClick={() => {
                    resolve.mutate({ id: existing.id }, { onSuccess: onClose });
                    notifyIfQueued(t('common.savesWhenOnline'));
                  }}
                >
                  {t('notes.resolve')}
                </Button>
              )}
            </Group>
          ) : (
            <span />
          )}
          {/* On the right, wrapped below the rest on a phone too. */}
          <Group gap="sm" ml="auto">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!text.trim()} loading={busy}>
              {t('common.save')}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * A report as whoever may fix the song reads it (D143): where, what, who; resolved once the
 * song is fixed. Not rewritten here: it's its reporter's.
 */
function ReportReview({
  note,
  resolve,
  onClose,
}: {
  note: NoteRecord;
  resolve: NoteRequests['resolve'];
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Stack>
      <Text size="sm" c="dimmed" lineClamp={2}>
        {note.line ? t('notes.atLine', { words: note.line.text }) : t('notes.wholeSong')}
      </Text>
      <Text style={{ whiteSpace: 'pre-line' }}>{note.text}</Text>
      <Text size="sm" c="dimmed">
        {t('notes.reportedBy', { name: note.authorName })}
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onClose}>
          {t('common.close')}
        </Button>
        <Button
          loading={resolve.isPending}
          onClick={() => {
            resolve.mutate({ id: note.id }, { onSuccess: onClose });
            notifyIfQueued(t('common.savesWhenOnline'));
          }}
        >
          {t('notes.resolve')}
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * The song's own comment (D145), by whoever may change the song: its text rewritten in place,
 * or removed, with an undo. Saved as an edit of the song, as everyone will read it.
 */
function SongCommentForm({
  song,
  at,
  text: written,
  comments,
  onClose,
}: {
  song: SongRecord;
  at: number;
  text: string;
  comments: SongComments;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState(written);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        comments.save(song, replaceComment(song.source, at, text), onClose);
      }}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {t('notes.songCommentHint')}
        </Text>
        <Textarea
          label={t('notes.songComment')}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          autosize
          minRows={1}
          maxLength={NOTE_TEXT_MAX}
          data-autofocus
          required
        />
        <Group justify="space-between">
          <Button
            variant="default"
            onClick={() => comments.removeWithUndo(song, at, onClose)}
          >
            {t('common.delete')}
          </Button>
          <Group gap="sm" ml="auto">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!commentText(text) || commentText(text) === written}
              loading={comments.pending}
            >
              {t('common.save')}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}
