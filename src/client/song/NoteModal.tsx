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
import { IconPencil } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { url } from '#shared/urls.ts';
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
import { useOnline } from '../hooks/useOnline.ts';
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

/**
 * What a new note is (D147): one's own note, or a TODO (one's own too, to tick off), the
 * playlist's, a report of a mistake (D143), or a comment written into the song itself (D145).
 */
type Audience = 'own' | 'todo' | 'playlist' | 'report' | 'song';

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
  const resolve = trpc.notes.resolve.useMutation({
    onSuccess: ({ note }, { id }) => putNote(id, note),
    onError: (error, { id }) => {
      const code = (error as { message?: string }).message;
      if (code === 'NOT_FOUND' || code === 'NOTE_RESOLVED') {
        putNote(id, null);
        notifications.show({ message: t('notes.alreadyResolved') });
      } else {
        onError(error);
      }
    },
    onSettled: (_result, _error, { id }) => settleNote(id),
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
    /**
     * A report fixed (D143), at once and taken back by one tap (D139), as a note is deleted:
     * it goes from sight while the toast says so, and is sent when the toast closes. Its
     * reporter keeps it, resolved (the server returns it to them); for anyone else it's gone.
     * Resolved meanwhile by another editor, it just goes.
     */
    resolveWithUndo: (note: NoteRecord) => {
      waitNote(note.id, null);
      showUndoToast({
        id: `note-resolved-${note.id}`,
        message: t('notes.resolvedDone'),
        onUndo: async () => settleNote(note.id),
        onKept: () => {
          resolve.mutate({ id: note.id });
          notifyIfQueued(t('common.savesWhenOnline'));
        },
      });
    },
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
    // Going out now; not one paused for the connection (D133), which the next mustn't wait on.
    pending: update.isPending && !update.isPaused,
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
 * playlist's, a report for the editors, D143, or a comment into the song, D145; chosen when
 * it's written), and for one's own, TODO and done. The title, the field and the button follow
 * that choice: the one place a private thought could be published by mistake. A report also
 * opens here for whoever may fix the song, to resolve it; and the song's own comment. The
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
  // Whom a new note is for, chosen in its form; as it was asked for until then.
  const [chosen, setChosen] = useState<{ key: string; audience: Audience } | null>(null);
  const audience: Audience =
    chosen?.key === key
      ? chosen.audience
      : target?.kind === 'edit' || target?.kind === 'review'
        ? target.note.kind === 'own' && target.note.todo
          ? 'todo'
          : target.note.kind
        : target?.kind === 'new' && target.report
          ? 'report'
          : 'own';
  const title =
    target === null
      ? ''
      : target.kind === 'new'
        ? t(NEW_TITLE[audience])
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
  const resolveNote = (note: NoteRecord) => {
    requests.resolveWithUndo(note);
    props.onClose();
  };
  return (
    <Modal opened={target !== null} onClose={props.onClose} title={title}>
      {target?.kind === 'review' && (
        <ReportReview
          key={key}
          note={target.note}
          onResolve={props.fixing ? resolveNote : null}
        />
      )}
      {target?.kind === 'comment' && props.fixing && (
        <SongCommentForm
          key={key}
          fixing={props.fixing}
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
          audience={audience}
          onAudience={(next) => setChosen({ key, audience: next })}
          requests={requests}
          comments={comments}
          onDelete={deleteNote}
          onResolve={resolveNote}
          {...props}
        />
      )}
    </Modal>
  );
}

/** A new note's title, by whom it's for. */
const NEW_TITLE = {
  own: 'notes.new',
  todo: 'notes.newTodo',
  playlist: 'notes.newForPlaylist',
  report: 'song.reportMistake',
  song: 'notes.newSongComment',
} as const;

/** What saves a new note, by whom it's for: saying what will happen. */
const SUBMIT = {
  own: 'common.save',
  todo: 'common.save',
  playlist: 'common.save',
  report: 'notes.sendReport',
  song: 'notes.writeIntoSong',
} as const;

function NoteForm({
  target,
  audience,
  onAudience,
  playlist,
  canReport,
  fixing,
  onClose,
  onSaved,
  requests: { create, update },
  comments,
  onDelete,
  onResolve,
}: Props & {
  target: Extract<NoteTarget, { kind: 'new' | 'edit' }>;
  audience: Audience;
  onAudience: (audience: Audience) => void;
  requests: NoteRequests;
  comments: SongComments;
  onDelete: (note: NoteRecord) => void;
  onResolve: (note: NoteRecord) => void;
}) {
  const { t } = useI18n();
  const { playlists } = useCatalog();
  // The song as it was when the dialog opened: a comment goes where the reader saw the line,
  // and a song changed meanwhile is refused (`seenAt`, D106), not written at a moved line.
  const online = useOnline();
  const [song] = useState(fixing);
  const existing = target.kind === 'edit' ? target.note : null;
  const ownPlaylist =
    existing && existing.playlistId !== null
      ? playlists.get(existing.playlistId)
      : undefined;
  const [text, setText] = useState(existing?.text ?? '');
  const [todo, setTodo] = useState(existing?.todo ?? false);
  const [done, setDone] = useState(existing !== null && existing.doneAt !== null);

  const words = target.kind === 'edit' ? target.note.line?.text : target.place?.words;
  const isOwn = audience === 'own' || audience === 'todo';

  const saved = (note: NoteRecord) => {
    // Done, it leaves the song: say where it went.
    if (note.doneAt !== null && existing?.doneAt === null) {
      notifications.show({ message: t('notes.doneMoved') });
    }
    // A report sent: say so, and where its fix will show.
    if (!existing && note.kind === 'report') {
      notifications.show({ message: t('notes.reported') });
    }
    onSaved?.();
    onClose();
  };

  const save = () => {
    if (audience === 'song') {
      // Offered only for a new note, to whoever may change the song.
      if (song && target.kind === 'new') {
        const source = addComment(song.source, target.place?.before ?? null, text);
        comments.save(song, source, () => {
          notifications.show({ message: t('notes.songCommentSaved') });
          onClose();
        });
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
          kind: isOwn ? 'own' : audience,
          playlistId: audience === 'playlist' && playlist ? playlist.id : null,
          text,
          todo: audience === 'todo',
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

  // One's own report, by whoever may fix the song: closed here once fixed.
  const resolvable = existing?.kind === 'report' && song !== null;
  // Only a request going out now: one waiting for the connection (D133) has let the dialog
  // close, and the next note mustn't wait on it.
  const busy =
    (create.isPending && !create.isPaused) ||
    (update.isPending && !update.isPaused) ||
    comments.pending;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Stack>
        <Text size="sm" c="dimmed" lineClamp={2}>
          {/* Written into the song, it goes above the line (D146): said so. */}
          {words
            ? t(audience === 'song' ? 'notes.aboveLine' : 'notes.atLine', { words })
            : t('notes.wholeSong')}
        </Text>
        <Textarea
          label={t('notes.textLabel')}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          autosize
          minRows={2}
          maxLength={NOTE_TEXT_MAX}
          data-autofocus
          required
        />
        {/* What it is is chosen once: a private note made the band's, or back, would
            change who has seen it. Each choice says who will see it (D147). */}
        {!existing && (
          <Radio.Group
            label={t('notes.kind')}
            value={audience}
            onChange={(v) => onAudience(v as Audience)}
          >
            <Stack gap="xs" mt={4}>
              <Radio
                value="own"
                label={t('notes.kindNote')}
                description={t('notes.kindNoteHint')}
              />
              <Radio
                value="todo"
                label={t('notes.kindTodo')}
                description={t('notes.kindTodoHint')}
              />
              {playlist && (
                <Radio
                  value="playlist"
                  label={t('notes.kindPlaylist', { name: playlist.name })}
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
                  label={t('notes.kindReport')}
                  description={t('notes.kindReportHint')}
                />
              )}
              {song && (
                // A private song's "everyone" is whoever it's shared with (D127). An edit of
                // the song, online only (D148).
                <Radio
                  value="song"
                  label={t('notes.kindSong')}
                  disabled={!online}
                  description={
                    !online
                      ? t('notes.onlineOnly')
                      : song.status === 'private'
                        ? t('notes.kindSongPrivateHint')
                        : t('notes.kindSongHint')
                  }
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
        {/* Changing one's own note: made a TODO or not, and ticked done (D147). */}
        {existing?.kind === 'own' && (
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
            <Button variant="default" onClick={() => onDelete(existing)}>
              {t('common.delete')}
            </Button>
          ) : (
            <span />
          )}
          {/* On the right, wrapped below the rest on a phone too. With "Vyřešeno" there,
              no "Zrušit": the × closes, and four buttons won't fit a phone's row. */}
          <Group gap="sm" ml="auto">
            {resolvable ? (
              <Button variant="default" onClick={() => onResolve(existing)}>
                {t('notes.resolve')}
              </Button>
            ) : (
              <Button variant="default" onClick={onClose}>
                {t('common.cancel')}
              </Button>
            )}
            <Button
              type="submit"
              disabled={!text.trim() || (audience === 'song' && !online)}
              loading={busy}
            >
              {existing ? t('common.save') : t(SUBMIT[audience])}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * A report as whoever may fix the song reads it (D143): where, what, who; the way to the song's
 * editor to fix it; resolved once fixed. Not rewritten here: it's its reporter's.
 */
function ReportReview({
  note,
  onResolve,
}: {
  note: NoteRecord;
  /** Null for the song's author who can't fix it (an approved song): they read it (D148). */
  onResolve: ((note: NoteRecord) => void) | null;
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
      {onResolve ? (
        // The × closes: two buttons, to fix it and to say it's fixed.
        <Group justify="flex-end" gap="sm">
          <Button
            variant="default"
            component={Link}
            to={url.editSong(note.songId)}
            leftSection={<IconPencil size={16} />}
          >
            {t('notes.editSong')}
          </Button>
          <Button onClick={() => onResolve(note)}>{t('notes.resolve')}</Button>
        </Group>
      ) : (
        <Text size="sm">{t('notes.editorWillFix')}</Text>
      )}
    </Stack>
  );
}

/**
 * The song's own comment (D145), by whoever may change the song: its text rewritten in place,
 * or removed, with an undo. Saved as an edit of the song, as everyone will read it, against the
 * song as it was when the dialog opened (`seenAt`, D106).
 */
function SongCommentForm({
  fixing,
  at,
  text: written,
  comments,
  onClose,
}: {
  fixing: SongRecord;
  at: number;
  text: string;
  comments: SongComments;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [song] = useState(fixing);
  const [text, setText] = useState(written);
  // An edit of the song, as everyone reads it: online only (D148), as nothing would show it
  // waiting meanwhile.
  const online = useOnline();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        comments.save(song, replaceComment(song.source, at, text), onClose);
      }}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {online ? t('notes.songCommentHint') : t('notes.songCommentOffline')}
        </Text>
        <Textarea
          label={t('notes.textLabel')}
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
            disabled={!online}
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
              disabled={!online || !commentText(text) || commentText(text) === written}
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
