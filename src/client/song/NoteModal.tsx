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
import { putNote, settleNote, useCatalog, waitNote } from '../data/catalog.ts';
import { useMe } from '../hooks/useMe.ts';
import { notifyIfQueued } from '../data/offline.ts';
import type { NoteRecord } from '../data/store.ts';
import { showUndoToast } from '../components/UndoToast.tsx';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';

/**
 * What the dialog is about: a new note at a line (null: the whole song), asked for as a report
 * from "Nahlásit chybu" (`report`); one to change; or a report for whoever may fix the song to
 * read and resolve (D143).
 */
export type NoteTarget =
  | { kind: 'new'; songId: number; place: NotePlace | null; report?: boolean }
  | { kind: 'edit'; note: NoteRecord }
  | { kind: 'review'; note: NoteRecord };

type Audience = NoteRecord['kind'];

type Props = {
  target: NoteTarget | null;
  /** The playlist being played from, where the reader may write its notes (D135). */
  playlist: { id: number; name: string; isPublic: boolean } | null;
  /** The reader may report a mistake in this song (D143). */
  canReport: boolean;
  /** The reader may fix the song, and so resolve a report of their own here too (D143). */
  canResolve: boolean;
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
 * Writing a note on a song, or changing one (D135): its text, who it's for (one's own, the
 * playlist's, or a report for the editors, D143; chosen when it's written), and for one's own,
 * TODO and done. A report also opens here for whoever may fix the song, to resolve it. The
 * requests live here, kept mounted, not in the form: one waiting for the connection (D133)
 * outlives the form, closed meanwhile, and still lands in the catalog, or says why it didn't.
 */
export function NoteModal({ target, ...props }: Props) {
  const { t } = useI18n();
  const requests = useNoteRequests();
  const key =
    target === null
      ? 'closed'
      : target.kind === 'new'
        ? `new-${target.place?.place ?? 'song'}-${target.report ? 'report' : 'note'}`
        : `${target.kind}-${target.note.id}`;
  const title =
    target === null
      ? ''
      : target.kind === 'new'
        ? target.report
          ? t('song.reportMistake')
          : t('notes.new')
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
      {/* A fresh form for each note: nothing typed for one carries over to the next. */}
      {target && target.kind !== 'review' && (
        <NoteForm
          key={key}
          target={target}
          requests={requests}
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
  canResolve,
  onClose,
  onSaved,
  requests: { create, update, resolve },
  onDelete,
}: Props & {
  target: Exclude<NoteTarget, { kind: 'review' }>;
  requests: NoteRequests;
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

  const busy = create.isPending || update.isPending;
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
              {existing.kind === 'report' && canResolve && (
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
