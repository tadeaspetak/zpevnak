import { Button, Center, Group, Stack, Text, TextInput, Title } from '@mantine/core';
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
import { VerifyEmailAlert } from '../components/VerifyEmailAlert.tsx';
import type { PlaylistOp } from '#shared/playlistOps.ts';
import { showUndoToast } from '../components/UndoToast.tsx';
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
import { trpc, trpcClient } from '../trpc.ts';
import { idFromRef, url } from '#shared/urls.ts';
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
  // Only while they may: someone taken out of the playlist meanwhile leaves the editor.
  const isEditing = editing && canEdit;
  const { role, visibility } = playlistFacts(playlist, { t, tn });
  const toggle = (songId: number) => {
    const last = playlist.songIds.lastIndexOf(songId);
    edits.edit(
      last === -1 ? { type: 'add', songId } : { type: 'remove', songId, index: last },
    );
  };
  const currentPosition = session?.playlistId === id ? session.position : null;
  // Taking a song out is one tap, so putting it back is one tap too, in its place (D87).
  const editWithUndo = (op: PlaylistOp) => {
    edits.edit(op);
    const song = op.type === 'remove' ? songs.get(op.songId) : undefined;
    if (op.type === 'remove' && song) {
      showUndoToast({
        id: `song-removed-${id}-${op.songId}-${op.index}`,
        message: t('playlists.songRemoved', { title: song.title }),
        // The toast may outlive this page: straight to the server, then into the catalog.
        onUndo: async () => {
          const back = await trpcClient.playlists.edit.mutate({
            id,
            op: { type: 'add', songId: op.songId, at: op.index },
          });
          putPlaylist(back.id, back);
        },
      });
    }
  };

  return (
    <>
      <PageHeader
        title={playlist.name}
        titleOnPhone="page"
        backTo={url.playlists()}
        backLabel={backLabel}
        actions={
          <>
            <RefreshButton playlistId={playlist.id} />
            {canEdit && (
              <IconButton
                label={isEditing ? t('playlists.done') : t('playlists.edit')}
                variant={isEditing ? 'filled' : undefined}
                color={isEditing ? 'orange' : undefined}
                onClick={() => setEditing((e) => !e)}
                aria-pressed={isEditing}
              >
                {isEditing ? <IconCheck size={20} /> : <IconPencil size={20} />}
              </IconButton>
            )}
            {/* Who's in, and the way out: any member, a confirmed email or not (D68). */}
            {isMember && (
              <IconButton
                label={t('playlists.share')}
                onClick={openShare}
                aria-haspopup="dialog"
              >
                <IconUsers size={20} />
              </IconButton>
            )}
            {canEdit && playlist.role === 'owner' && (
              <IconButton label={t('common.delete')} onClick={confirmDelete}>
                <IconTrash size={20} />
              </IconButton>
            )}
          </>
        }
      />
      {/* Playing another playlist: the way back to it (D32). */}
      <Page pill={session !== null && session.playlistId !== id}>
        <Stack gap="md">
          {/* On a phone the header has no room for the name beside its icons: here, whole. */}
          <Title order={1} size="h3" hiddenFrom="sm">
            {playlist.name}
          </Title>
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" c="dimmed">
              {[tn('common.songs', playlist.songIds.length), role, visibility].join(
                ' · ',
              )}
            </Text>
            {!isEditing && playlist.songIds.length > 0 && (
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
            <VerifyEmailAlert message={t('playlists.confirmToEdit')} />
          )}
          {isEditing && <PlaylistSettings playlist={playlist} onRename={edits.rename} />}

          {playlist.songIds.length === 0 && (
            <Center py="xl">
              <Stack align="center" gap="sm">
                <Text c="dimmed">{t('playlists.empty')}</Text>
              </Stack>
            </Center>
          )}

          {isEditing ? (
            <SortableSongs
              songIds={playlist.songIds}
              songs={songs}
              onEdit={editWithUndo}
            />
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

          {/* In reach whenever they may add, not only in the editor (with the empty list's
              message above it). */}
          {canEdit && (
            <Button
              variant="default"
              leftSection={<IconPlus size={16} />}
              onClick={openAdd}
              style={playlist.songIds.length === 0 ? { alignSelf: 'center' } : undefined}
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
        title={t('playlists.deleteTitle')}
        confirmLabel={t('common.delete')}
        onConfirm={() => remove.mutate({ id })}
        loading={remove.isPending}
        error={remove.error}
      >
        <Text>
          {t('playlists.deleteConfirm', {
            name: playlist.name,
            // Listmates lose it too: said only when there are some.
            listmates: playlist.collaboratorCount
              ? t('playlists.deleteListmates', { count: playlist.collaboratorCount })
              : '',
          })}
        </Text>
      </ConfirmModal>
    </>
  );
}

function PlaylistSettings({
  playlist,
  onRename,
}: {
  playlist: PlaylistRecord;
  onRename: (name: string) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(playlist.name);
  // On Enter or on leaving the field. Emptied, it goes back to the name it had.
  const commit = () => {
    if (!name.trim()) {
      setName(playlist.name);
    } else if (name !== playlist.name) {
      onRename(name);
    }
  };
  return (
    <Stack gap="sm" className={classes.settings}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <TextInput
          label={t('playlists.name')}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onBlur={commit}
        />
      </form>
    </Stack>
  );
}
