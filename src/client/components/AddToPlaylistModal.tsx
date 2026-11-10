import {
  Button,
  Divider,
  Modal,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { putPlaylist, useCatalog } from '../data/catalog.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { ErrorText } from './ErrorText.tsx';
import classes from './SongRow.module.css';

type Props = { songId: number | null; onClose: () => void };

/** Adds a song to the end of one of my playlists, or to a new one. */
export function AddToPlaylistModal({ songId, onClose }: Props) {
  const { t } = useI18n();
  const { playlists } = useCatalog();
  // Every playlist the viewer may change: their own and those they collaborate on.
  const mine = [...playlists.values()].filter((p) => p.role !== null);
  const [name, setName] = useState('');
  const added = (playlist: Parameters<typeof putPlaylist>[1] & object) => {
    putPlaylist(playlist.id, playlist);
    notifications.show({
      message: t('playlists.added', { name: playlist.name }),
      icon: <IconCheck size={16} />,
    });
    close();
  };
  // A failure shows in the dialog through `.error`; the next opening starts clean.
  const edit = trpc.playlists.edit.useMutation({ onSuccess: added });
  const create = trpc.playlists.create.useMutation({ onSuccess: added });
  const close = () => {
    setName('');
    edit.reset();
    create.reset();
    onClose();
  };

  return (
    <Modal opened={songId !== null} onClose={close} title={t('song.addToPlaylist')}>
      {songId !== null && (
        <Stack gap="sm">
          <ErrorText error={edit.error ?? create.error} />
          {mine.length > 0 && (
            <Stack gap={0}>
              {mine.map((p) => (
                <UnstyledButton
                  key={p.id}
                  className={classes.row}
                  disabled={edit.isPending}
                  onClick={() => edit.mutate({ id: p.id, op: { type: 'add', songId } })}
                >
                  <Text fw={600}>{p.name}</Text>
                  {p.songIds.includes(songId) && (
                    <Text size="xs" c="dimmed">
                      ✓
                    </Text>
                  )}
                </UnstyledButton>
              ))}
            </Stack>
          )}
          {mine.length > 0 && <Divider />}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({ name, isPublic: false, songIds: [songId] });
            }}
          >
            <Stack gap="xs">
              <TextInput
                label={t('playlists.newWithSong')}
                placeholder={t('playlists.name')}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                required
              />
              <Button
                type="submit"
                leftSection={<IconPlus size={16} />}
                loading={create.isPending}
              >
                {t('playlists.create')}
              </Button>
            </Stack>
          </form>
        </Stack>
      )}
    </Modal>
  );
}
