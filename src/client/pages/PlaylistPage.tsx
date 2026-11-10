import {
  Alert,
  Button,
  Center,
  Group,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconCheck,
  IconPencil,
  IconPlayerPlayFilled,
  IconPlus,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { RefreshButton } from '../components/RefreshButton.tsx';
import { ShareModal } from '../components/ShareModal.tsx';
import { SongPicker } from '../components/SongPicker.tsx';
import { SongRow } from '../components/SongRow.tsx';
import { Position, SortableSongs } from '../components/SortableSongs.tsx';
import { putPlaylist, useCatalog } from '../data/catalog.ts';
import { useFreshPlaylist } from '../data/freshPlaylist.ts';
import { usePlaylistEdits } from '../data/playlistEdits.ts';
import { playlistFacts } from '../data/playlistFacts.ts';
import { leavePlaylist, usePlayer } from '../data/session.ts';
import type { PlaylistRecord } from '../data/store.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { idFromRef, url } from '../urls.ts';
import { useCanonicalPath } from '../hooks/useCanonicalPath.ts';
import classes from './PlaylistPage.module.css';
import { IconButton } from '../components/IconButton.tsx';

export function PlaylistPage() {
  const { t, tn } = useI18n();
  const navigate = useNavigate();
  const id = idFromRef(useParams().playlistRef) ?? 0;
  const { playlists, songs, loaded } = useCatalog();
  const { session } = usePlayer();
  const { me } = useMe();
  const playlist = playlists.get(id);
  useCanonicalPath(playlist ? url.playlist(playlist) : null);
  useFreshPlaylist(id);
  const edits = usePlaylistEdits(id);
  const [editing, setEditing] = useState(false);
  const [adding, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const [sharing, { open: openShare, close: closeShare }] = useDisclosure(false);
  const [confirmingDelete, { open: confirmDelete, close: cancelDelete }] =
    useDisclosure(false);
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
  const backLabel = t('nav.backTo', { name: t('playlists.title') });
  if (!playlist) {
    return (
      <>
        <PageHeader
          title={t('playlists.title')}
          backTo={url.playlists()}
          backLabel={backLabel}
        />
        <Page>
          <Text>{t('playlists.notFound')}</Text>
        </Page>
      </>
    );
  }

  // Owner and collaborators change the songs and the name, once their email is confirmed.
  const isMember = playlist.role !== null;
  const canEdit = isMember && Boolean(me?.emailVerified);
  const { role, visibility } = playlistFacts(playlist, { t, tn });
  const toggle = (songId: number) => {
    const last = playlist.songIds.lastIndexOf(songId);
    edits.edit(
      last === -1 ? { type: 'add', songId } : { type: 'remove', songId, index: last },
    );
  };
  const currentPosition = session?.playlistId === id ? session.position : null;

  return (
    <>
      <PageHeader
        title={playlist.name}
        backTo={url.playlists()}
        backLabel={backLabel}
        actions={
          <>
            <RefreshButton playlistId={playlist.id} />
            {canEdit && (
              <>
                <IconButton
                  label={editing ? t('playlists.done') : t('playlists.edit')}
                  variant={editing ? 'filled' : undefined}
                  color={editing ? 'orange' : undefined}
                  onClick={() => setEditing((e) => !e)}
                  aria-pressed={editing}
                >
                  {editing ? <IconCheck size={20} /> : <IconPencil size={20} />}
                </IconButton>
                <IconButton
                  label={t('playlists.share')}
                  onClick={openShare}
                  aria-haspopup="dialog"
                >
                  <IconUsers size={20} />
                </IconButton>
                {playlist.role === 'owner' && (
                  <IconButton label={t('common.delete')} onClick={confirmDelete}>
                    <IconTrash size={20} />
                  </IconButton>
                )}
              </>
            )}
          </>
        }
      />
      <Page>
        <Stack gap="md">
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" c="dimmed">
              {[tn('common.songs', playlist.songIds.length), role, visibility].join(
                ' · ',
              )}
            </Text>
            {!editing && playlist.songIds.length > 0 && (
              <Button
                component={Link}
                to={url.playlistSong(playlist, currentPosition ?? 1)}
                leftSection={<IconPlayerPlayFilled size={16} />}
                // The details beside it wrap; the button never shrinks.
                style={{ flexShrink: 0 }}
              >
                {/* Mid-playlist it carries on where the player is; say so. */}
                {currentPosition !== null && currentPosition > 1
                  ? t('playlists.continue')
                  : t('playlists.play')}
              </Button>
            )}
          </Group>

          {isMember && !canEdit && (
            <Alert color="yellow">{t('playlists.confirmToEdit')}</Alert>
          )}
          {editing && (
            <PlaylistSettings
              playlist={playlist}
              onRename={edits.rename}
              onPublic={edits.setPublic}
            />
          )}

          {playlist.songIds.length === 0 && (
            <Center py="xl">
              <Stack align="center" gap="sm">
                <Text c="dimmed">{t('playlists.empty')}</Text>
                {canEdit && !editing && (
                  <Button
                    variant="default"
                    leftSection={<IconPlus size={16} />}
                    onClick={openAdd}
                  >
                    {t('playlists.addSongs')}
                  </Button>
                )}
              </Stack>
            </Center>
          )}

          {editing ? (
            <SortableSongs songIds={playlist.songIds} songs={songs} onEdit={edits.edit} />
          ) : (
            <Stack gap={0} mx="-md">
              {playlist.songIds.map((songId, index) => {
                const song = songs.get(songId);
                const position = index + 1;
                return song ? (
                  <SongRow
                    key={`${songId}-${index}`}
                    song={song}
                    to={url.playlistSong(playlist, position)}
                    active={currentPosition === position}
                    leading={
                      <Position n={position} active={currentPosition === position} />
                    }
                  />
                ) : null;
              })}
            </Stack>
          )}

          {editing && (
            <Button
              variant="default"
              leftSection={<IconPlus size={16} />}
              onClick={openAdd}
            >
              {t('playlists.addSongs')}
            </Button>
          )}
        </Stack>
      </Page>

      <SongPicker
        opened={adding}
        onClose={closeAdd}
        playlistId={playlist.id}
        songIds={playlist.songIds}
        onToggle={toggle}
      />
      <ShareModal playlist={playlist} opened={sharing} onClose={closeShare} />
      <ConfirmModal
        opened={confirmingDelete}
        onClose={cancelDelete}
        title={t('common.delete')}
        confirmLabel={t('common.delete')}
        onConfirm={() => remove.mutate({ id })}
        loading={remove.isPending}
        error={remove.error}
      >
        <Text>{t('playlists.deleteConfirm', { name: playlist.name })}</Text>
      </ConfirmModal>
    </>
  );
}

function PlaylistSettings({
  playlist,
  onRename,
  onPublic,
}: {
  playlist: PlaylistRecord;
  onRename: (name: string) => void;
  onPublic: (isPublic: boolean) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(playlist.name);
  return (
    <Stack gap="sm" className={classes.settings}>
      <TextInput
        label={t('playlists.name')}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        onBlur={() => {
          if (name.trim() && name !== playlist.name) {
            onRename(name);
          }
        }}
      />
      {/* Who can see it is the owner's call. */}
      {playlist.role === 'owner' && (
        <Switch
          label={t('playlists.isPublic')}
          checked={playlist.isPublic}
          onChange={(e) => onPublic(e.currentTarget.checked)}
        />
      )}
    </Stack>
  );
}
