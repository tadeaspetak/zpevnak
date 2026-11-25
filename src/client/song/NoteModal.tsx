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
import { putNote, settleNote, useCatalog, waitNote } from '../data/catalog.ts';
import { useMe } from '../hooks/useMe.ts';
import { notifyIfQueued } from '../data/offline.ts';
import type { NoteRecord } from '../data/store.ts';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';

/** What the dialog is about: a new note at a line (null: the whole song), or one to change. */
export type NoteTarget =
  | { kind: 'new'; songId: number; place: NotePlace | null }
  | { kind: 'edit'; note: NoteRecord };

type Props = {
  target: NoteTarget | null;
  /** The playlist being played from, where the reader may write its notes (D135). */
  playlist: { id: number; name: string; isPublic: boolean } | null;
  /** Name the note's song too: the dialog is opened away from it (Moje poznámky). */
  showSong?: boolean;
  onClose: () => void;
  /** After a note is saved. */
  onSaved?: () => void;
};

/**
 * Writing a note on a song, or changing one (D135): its text, who it's for (one's own or the
 * playlist's, chosen when it's written), and for one's own, TODO and done. The requests live
 * here, kept mounted, not in the form: one waiting for the connection (D133) outlives the
 * form, closed meanwhile, and still lands in the catalog, or says why it didn't.
 */
/**
 * Writing, changing and deleting notes (D135), wherever it's done: the dialog, a TODO ticked in
 * Moje poznámky. What the server returns goes into the catalog. Offline, a change shows at once,
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
          playlistId: input.playlistId,
          authorId: me.id,
          authorName: me.displayName,
          text: input.text,
          todo: input.todo,
          doneAt: null,
          line: input.line,
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
    remove: trpc.notes.delete.useMutation({
      onMutate: (input) => {
        if (!navigator.onLine) {
          waitNote(input.id, null);
        }
      },
      onSuccess: (_, { id }) => {
        putNote(id, null);
        notifications.show({ message: t('notes.deleted') });
      },
      onError: (error) => onError(error),
      onSettled: (_result, _error, input) => settleNote(input.id),
    }),
  };
}

type NoteRequests = ReturnType<typeof useNoteRequests>;

export function NoteModal({ target, ...props }: Props) {
  const { t } = useI18n();
  const requests = useNoteRequests();
  const [deleting, setDeleting] = useState<NoteRecord | null>(null);
  const key =
    target === null
      ? 'closed'
      : target.kind === 'edit'
        ? `note-${target.note.id}`
        : `new-${target.place?.place ?? 'song'}`;
  const deleteNote = (note: NoteRecord) => {
    requests.remove.mutate(
      { id: note.id },
      {
        onSuccess: () => {
          setDeleting(null);
          props.onClose();
        },
      },
    );
    notifyIfQueued(t('common.savesWhenOnline'));
    if (!navigator.onLine) {
      setDeleting(null);
      props.onClose();
    }
  };
  return (
    <>
      <Modal
        opened={target !== null}
        onClose={props.onClose}
        title={target?.kind === 'edit' ? t('notes.edit') : t('notes.new')}
      >
        {/* A fresh form for each note: nothing typed for one carries over to the next. */}
        {target && (
          <NoteForm
            key={key}
            target={target}
            requests={requests}
            onDelete={setDeleting}
            {...props}
          />
        )}
      </Modal>
      <ConfirmModal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('notes.deleteTitle')}
        confirmLabel={t('common.delete')}
        onConfirm={() => deleting && deleteNote(deleting)}
        loading={requests.remove.isPending}
        error={null}
      >
        <Text>{deleting?.text}</Text>
      </ConfirmModal>
    </>
  );
}

function NoteForm({
  target,
  playlist,
  showSong = false,
  onClose,
  onSaved,
  requests: { create, update },
  onDelete,
}: Props & {
  target: NoteTarget;
  requests: NoteRequests;
  onDelete: (note: NoteRecord) => void;
}) {
  const { t } = useI18n();
  const { songs, playlists } = useCatalog();
  const existing = target.kind === 'edit' ? target.note : null;
  const songTitle = showSong && existing ? songs.get(existing.songId)?.title : undefined;
  const ownPlaylist =
    existing && existing.playlistId !== null
      ? playlists.get(existing.playlistId)
      : undefined;
  const [text, setText] = useState(existing?.text ?? '');
  const [forPlaylist, setForPlaylist] = useState(
    existing !== null && existing.playlistId !== null,
  );
  const [todo, setTodo] = useState(existing?.todo ?? false);
  const [done, setDone] = useState(existing !== null && existing.doneAt !== null);

  const words = target.kind === 'edit' ? target.note.line?.text : target.place?.words;
  const isPrivate = existing ? existing.playlistId === null : !forPlaylist;
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
          todo: isPrivate && todo,
          done: isPrivate && todo && done,
        },
        { onSuccess: saved },
      );
    } else if (target.kind === 'new') {
      create.mutate(
        {
          songId: target.songId,
          playlistId: forPlaylist && playlist ? playlist.id : null,
          text,
          todo: isPrivate && todo,
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
          {[songTitle, words ? t('notes.atLine', { words }) : t('notes.wholeSong')]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Textarea
          label={t('notes.text')}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          autosize
          minRows={2}
          maxLength={2000}
          data-autofocus
          required
        />
        {/* Who it's for is chosen once: a private note made the band's, or back, would
            change who has seen it. */}
        {/* The whole name, and who will see it: the one place a private thought could be
            published by mistake. */}
        {!existing && playlist && (
          <Radio.Group
            label={t('notes.audience')}
            value={forPlaylist ? 'playlist' : 'me'}
            onChange={(v) => setForPlaylist(v === 'playlist')}
          >
            <Stack gap="xs" mt={4}>
              <Radio value="me" label={t('notes.forMe')} />
              <Radio
                value="playlist"
                label={t('notes.forPlaylist', { name: playlist.name })}
                description={
                  playlist.isPublic
                    ? t('notes.forPublicPlaylistHint')
                    : t('notes.forPlaylistHint')
                }
              />
            </Stack>
          </Radio.Group>
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
        {isPrivate && (
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
          <Group gap="sm">
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
