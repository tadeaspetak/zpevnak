import {
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { toggleOp } from '#shared/playlistOps.ts';
import { editsAsMember } from '#shared/roles.ts';
import { putPlaylist, useCatalog } from '../data/catalog.ts';
import { touchPlaylist } from '../data/session.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { ErrorText } from './ErrorText.tsx';
import { PrivateSongReach } from './PrivateSongReach.tsx';
import classes from './AddToPlaylistModal.module.css';

type Props = { songId: number | null; onClose: () => void };

/**
 * The song in or out of each of my playlists, a checkbox each (D124): ticked is in, a tap
 * switches it, and the dialog stays open for the next one. Or a new playlist with the song.
 */
export function AddToPlaylistModal({ songId, onClose }: Props) {
  const { t } = useI18n();
  const { playlists, songs } = useCatalog();
  const song = songId === null ? undefined : songs.get(songId);
  // Every playlist the viewer may change: their own and those they collaborate on.
  const mine = [...playlists.values()].filter((p) => editsAsMember(p.role));
  const [name, setName] = useState('');
  // A failure shows in the dialog through `.error`; the next opening starts clean.
  const edit = trpc.playlists.edit.useMutation({
    onSuccess: (playlist) => putPlaylist(playlist.id, playlist),
  });
  const create = trpc.playlists.create.useMutation({
    onSuccess: (playlist) => {
      touchPlaylist(playlist.id);
      putPlaylist(playlist.id, playlist);
      notifications.show({
        message: t('playlists.added', { name: playlist.name }),
        icon: <IconCheck size={16} />,
      });
      close();
    },
  });
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
          {mine.length > 0 && (
            <Stack gap={4}>
              {mine.map((p) => (
                <Stack key={p.id} gap={4}>
                  <Checkbox.Card
                    className={classes.option}
                    checked={p.songIds.includes(songId)}
                    // One change at a time per playlist: a second tap waits for the first.
                    disabled={edit.isPending && edit.variables?.id === p.id}
                    onClick={() =>
                      edit.mutate({ id: p.id, op: toggleOp(p.songIds, songId) })
                    }
                  >
                    <Group wrap="nowrap" gap="sm">
                      <Checkbox.Indicator />
                      <div>
                        <Text fw={600}>{p.name}</Text>
                        {song && (
                          <PrivateSongReach song={song} listmates={p.listmateCount} />
                        )}
                      </div>
                    </Group>
                  </Checkbox.Card>
                  {/* Under the playlist it is about: "there" needs no name. */}
                  {edit.variables?.id === p.id && <ErrorText error={edit.error} />}
                </Stack>
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
              <ErrorText error={create.error} />
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
