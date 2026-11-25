import {
  Button,
  Checkbox,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import type { NotePlace } from '#shared/notes.ts';
import { putNote } from '../data/catalog.ts';
import { notifyIfQueued } from '../data/offline.ts';
import type { NoteRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';

/** What the dialog is about: a new note at a line (null: the whole song), or one to change. */
export type NoteTarget =
  | { kind: 'new'; songId: number; place: NotePlace | null }
  | { kind: 'edit'; note: NoteRecord };

type Props = {
  target: NoteTarget | null;
  /** The playlist being played from, where the reader may write its notes (D135). */
  playlist: { id: number; name: string } | null;
  onClose: () => void;
  /** After a note is saved. */
  onSaved?: () => void;
};

/**
 * Writing a note on a song, or changing one (D135): its text, who it's for (one's own or the
 * playlist's, chosen when it's written), and for one's own, TODO and done. Kept mounted, so a
 * save that waits for the connection still lands.
 */
export function NoteModal({ target, ...props }: Props) {
  const { t } = useI18n();
  const key =
    target === null
      ? 'closed'
      : target.kind === 'edit'
        ? `note-${target.note.id}`
        : `new-${target.place?.place ?? 'song'}`;
  return (
    <Modal
      opened={target !== null}
      onClose={props.onClose}
      title={target?.kind === 'edit' ? t('notes.edit') : t('notes.new')}
    >
      {/* A fresh form for each note: nothing typed for one carries over to the next. */}
      {target && <NoteForm key={key} target={target} {...props} />}
    </Modal>
  );
}

function NoteForm({
  target,
  playlist,
  onClose,
  onSaved,
}: Props & { target: NoteTarget }) {
  const { t, tError } = useI18n();
  const existing = target.kind === 'edit' ? target.note : null;
  const [text, setText] = useState(existing?.text ?? '');
  const [forPlaylist, setForPlaylist] = useState(
    existing !== null && existing.playlistId !== null,
  );
  const [todo, setTodo] = useState(existing?.todo ?? false);
  const [done, setDone] = useState(existing !== null && existing.doneAt !== null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const create = trpc.notes.create.useMutation();
  const update = trpc.notes.update.useMutation();
  const remove = trpc.notes.delete.useMutation();

  const words = target.kind === 'edit' ? target.note.line?.text : target.place?.words;
  const isPrivate = existing ? existing.playlistId === null : !forPlaylist;
  const onError = (error: unknown) =>
    notifications.show({ color: 'red', message: tError(error) });
  // Offline, the change waits for the connection (D133): the dialog doesn't wait with it.
  const sent = () => {
    notifyIfQueued(t('common.savesWhenOnline'));
    if (!navigator.onLine) {
      onClose();
    }
  };
  const saved = (note: NoteRecord) => {
    putNote(note.id, note);
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
        { onSuccess: saved, onError },
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
        { onSuccess: saved, onError },
      );
    }
    sent();
  };

  const deleteNote = () => {
    if (!existing) {
      return;
    }
    remove.mutate(
      { id: existing.id },
      {
        onSuccess: () => {
          putNote(existing.id, null);
          notifications.show({ message: t('notes.deleted') });
          onClose();
        },
        onError,
      },
    );
    sent();
  };

  const busy = create.isPending || update.isPending || remove.isPending;
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
          maxLength={2000}
          data-autofocus
          required
        />
        {/* Who it's for is chosen once: a private note made the band's, or back, would
            change who has seen it. */}
        {!existing && playlist && (
          <SegmentedControl
            fullWidth
            aria-label={t('notes.audience')}
            value={forPlaylist ? 'playlist' : 'me'}
            onChange={(v) => setForPlaylist(v === 'playlist')}
            data={[
              { value: 'me', label: t('notes.forMe') },
              {
                value: 'playlist',
                label: t('notes.forPlaylist', { name: playlist.name }),
              },
            ]}
          />
        )}
        {existing && existing.playlistId !== null && (
          <Text size="sm" c="dimmed">
            {t('notes.byAuthor', { name: existing.authorName })}
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
            <Button
              variant={confirmingDelete ? 'filled' : 'default'}
              color={confirmingDelete ? 'red' : undefined}
              onClick={() =>
                confirmingDelete ? deleteNote() : setConfirmingDelete(true)
              }
              loading={remove.isPending}
            >
              {confirmingDelete ? t('notes.deleteConfirm') : t('common.delete')}
            </Button>
          ) : (
            <span />
          )}
          <Group gap="sm">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!text.trim()}
              loading={busy && !remove.isPending}
            >
              {t('common.save')}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}
