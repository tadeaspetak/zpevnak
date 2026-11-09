import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Group,
  Menu,
  Modal,
  Stack,
  Switch,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowDown,
  IconArrowUp,
  IconDots,
  IconEdit,
  IconPlayerPlayFilled,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ErrorText } from '../components/ErrorText.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { SongRow } from '../components/SongRow.tsx';
import { putPlaylist, useCatalog } from '../data/catalog.ts';
import { useSongSearch } from '../data/search.ts';
import { leavePlaylist, usePlayer } from '../data/session.ts';
import type { PlaylistRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';
import classes from './PlaylistPage.module.css';

export function PlaylistPage() {
  const { t, tn } = useI18n();
  const navigate = useNavigate();
  const id = Number(useParams().id);
  const { playlists, songs, loaded } = useCatalog();
  const { session } = usePlayer();
  const playlist = playlists.get(id);
  const [editing, setEditing] = useState(false);
  const [adding, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const [confirmingDelete, { open: confirmDelete, close: cancelDelete }] =
    useDisclosure(false);

  const update = trpc.playlists.update.useMutation({
    onSuccess: (p) => putPlaylist(p.id, p),
  });
  const remove = trpc.playlists.delete.useMutation({
    onSuccess: () => {
      putPlaylist(id, null);
      if (session?.playlistId === id) {
        leavePlaylist();
      }
      navigate(url.playlists());
    },
  });

  if (!loaded) {
    return null;
  }
  if (!playlist) {
    return (
      <>
        <PageHeader
          title={t('playlists.title')}
          backTo={url.playlists()}
          backLabel={t('nav.backTo', { name: t('playlists.title') })}
        />
        <Page>
          <Text>{t('playlists.notFound')}</Text>
        </Page>
      </>
    );
  }

  const setSongIds = (songIds: number[]) => update.mutate({ id, songIds });
  const move = (index: number, by: -1 | 1) => {
    const next = [...playlist.songIds];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item as number);
    setSongIds(next);
  };
  const currentPosition = session?.playlistId === id ? session.position : null;

  return (
    <>
      <PageHeader
        title={playlist.name}
        backTo={url.playlists()}
        backLabel={t('nav.backTo', { name: t('playlists.title') })}
        actions={
          playlist.isMine && (
            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  aria-label={t('song.more')}
                >
                  <IconDots size={20} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconEdit size={16} />}
                  onClick={() => setEditing(true)}
                >
                  {t('playlists.edit')}
                </Menu.Item>
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={confirmDelete}
                >
                  {t('common.delete')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )
        }
      />
      <Page>
        <Stack gap="md">
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" c="dimmed">
              {tn('common.songs', playlist.songIds.length)}
              {' · '}
              {playlist.isMine
                ? playlist.isPublic
                  ? t('common.public')
                  : t('common.private')
                : t('playlists.by', { name: playlist.ownerName })}
            </Text>
            {!editing && playlist.songIds.length > 0 && (
              <Button
                component={Link}
                to={url.playlistSong(id, currentPosition ?? 1)}
                leftSection={<IconPlayerPlayFilled size={16} />}
              >
                {t('playlists.play')}
              </Button>
            )}
            {editing && (
              <Button variant="light" onClick={() => setEditing(false)}>
                {t('playlists.done')}
              </Button>
            )}
          </Group>

          {editing && <PlaylistSettings playlist={playlist} />}
          <ErrorText error={update.error ?? remove.error} />

          {playlist.songIds.length === 0 && !editing && (
            <Center py="xl">
              <Stack align="center" gap="sm">
                <Text c="dimmed">{t('playlists.empty')}</Text>
                {playlist.isMine && (
                  <Button
                    variant="light"
                    leftSection={<IconPlus size={16} />}
                    onClick={openAdd}
                  >
                    {t('playlists.addSongs')}
                  </Button>
                )}
              </Stack>
            </Center>
          )}

          <Stack gap={0} mx="-md">
            {playlist.songIds.map((songId, index) => {
              const song = songs.get(songId);
              const position = index + 1;
              if (!song) {
                return null;
              }
              return (
                <Group key={`${songId}-${index}`} gap={0} wrap="nowrap">
                  <div className={classes.grow}>
                    <SongRow
                      song={song}
                      to={url.playlistSong(id, position)}
                      active={currentPosition === position}
                      leading={
                        <Text
                          c="dimmed"
                          fw={600}
                          w="1.75rem"
                          ta="right"
                          className={classes.number}
                        >
                          {position}
                        </Text>
                      }
                    />
                  </div>
                  {editing && (
                    <Group gap={0} wrap="nowrap" pr="xs">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="lg"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        aria-label={t('playlists.moveUp')}
                      >
                        <IconArrowUp size={18} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="lg"
                        disabled={index === playlist.songIds.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label={t('playlists.moveDown')}
                      >
                        <IconArrowDown size={18} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="lg"
                        onClick={() =>
                          setSongIds(playlist.songIds.filter((_, i) => i !== index))
                        }
                        aria-label={t('playlists.remove')}
                      >
                        <IconX size={18} />
                      </ActionIcon>
                    </Group>
                  )}
                </Group>
              );
            })}
          </Stack>

          {editing && (
            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={openAdd}
            >
              {t('playlists.addSongs')}
            </Button>
          )}
        </Stack>
      </Page>

      <AddSongsModal
        opened={adding}
        onClose={closeAdd}
        songIds={playlist.songIds}
        onAdd={(songId) => setSongIds([...playlist.songIds, songId])}
      />
      <Modal opened={confirmingDelete} onClose={cancelDelete} title={t('common.delete')}>
        <Stack>
          <Text>{t('playlists.deleteConfirm', { name: playlist.name })}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={cancelDelete}>
              {t('common.cancel')}
            </Button>
            <Button
              color="red"
              loading={remove.isPending}
              onClick={() => remove.mutate({ id })}
            >
              {t('common.delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function PlaylistSettings({ playlist }: { playlist: PlaylistRecord }) {
  const { t } = useI18n();
  const [name, setName] = useState(playlist.name);
  const update = trpc.playlists.update.useMutation({
    onSuccess: (p) => putPlaylist(p.id, p),
  });
  return (
    <Stack gap="sm" className={classes.settings}>
      <TextInput
        label={t('playlists.name')}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        onBlur={() => {
          if (name.trim() && name !== playlist.name) {
            update.mutate({ id: playlist.id, name });
          }
        }}
      />
      <Switch
        label={t('playlists.isPublic')}
        checked={playlist.isPublic}
        onChange={(e) =>
          update.mutate({ id: playlist.id, isPublic: e.currentTarget.checked })
        }
      />
      <ErrorText error={update.error} />
    </Stack>
  );
}

function AddSongsModal({
  opened,
  onClose,
  songIds,
  onAdd,
}: {
  opened: boolean;
  onClose: () => void;
  songIds: number[];
  onAdd: (songId: number) => void;
}) {
  const { t } = useI18n();
  const { songs } = useCatalog();
  const search = useSongSearch(songs);
  const [query, setQuery] = useState('');
  const hits = useMemo(() => search(query).slice(0, 30), [search, query]);
  return (
    <Modal opened={opened} onClose={onClose} title={t('playlists.addSongs')} size="lg">
      <Stack gap="sm">
        <TextInput
          data-autofocus
          type="search"
          placeholder={t('home.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <Stack gap={0}>
          {hits.map(({ song }) => (
            <UnstyledButton
              key={song.id}
              className={classes.addRow}
              onClick={() => onAdd(song.id)}
            >
              <Group justify="space-between" wrap="nowrap">
                <div className={classes.grow}>
                  <Text fw={600} truncate>
                    {song.title}
                  </Text>
                  <Text size="sm" c="dimmed" truncate>
                    {song.artist}
                  </Text>
                </div>
                {songIds.includes(song.id) ? (
                  <Badge variant="light">✓</Badge>
                ) : (
                  <IconPlus size={18} />
                )}
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      </Stack>
    </Modal>
  );
}
