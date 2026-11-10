import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ActionIcon,
  Alert,
  Button,
  Center,
  Group,
  Modal,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconCheck,
  IconGripVertical,
  IconPencil,
  IconPlayerPlayFilled,
  IconPlus,
  IconTrash,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { PlaylistOp } from '#shared/playlistOps.ts';
import { Link, useNavigate, useParams } from 'react-router';
import { ErrorText } from '../components/ErrorText.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { RefreshButton } from '../components/RefreshButton.tsx';
import { ShareModal } from '../components/ShareModal.tsx';
import { SongPicker } from '../components/SongPicker.tsx';
import { SongRow } from '../components/SongRow.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { putPlaylist, useCatalog } from '../data/catalog.ts';
import { useFreshPlaylist } from '../data/freshPlaylist.ts';
import { usePlaylistEdits } from '../data/playlistEdits.ts';
import { playlistFacts } from '../data/playlistFacts.ts';
import { leavePlaylist, usePlayer } from '../data/session.ts';
import type { PlaylistRecord, SongRecord } from '../data/store.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { idFromRef, url } from '../urls.ts';
import { useCanonicalPath } from '../hooks/useCanonicalPath.ts';
import classes from './PlaylistPage.module.css';

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
                <Tooltip label={editing ? t('playlists.done') : t('playlists.edit')}>
                  <ActionIcon
                    variant={editing ? 'filled' : 'subtle'}
                    color={editing ? undefined : 'gray'}
                    size="lg"
                    onClick={() => setEditing((e) => !e)}
                    aria-label={editing ? t('playlists.done') : t('playlists.edit')}
                    aria-pressed={editing}
                  >
                    {editing ? <IconCheck size={20} /> : <IconPencil size={20} />}
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={t('playlists.share')}>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="lg"
                    onClick={openShare}
                    aria-label={t('playlists.share')}
                    aria-haspopup="dialog"
                  >
                    <IconUsers size={20} />
                  </ActionIcon>
                </Tooltip>
                {playlist.role === 'owner' && (
                  <Tooltip label={t('common.delete')}>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="lg"
                      onClick={confirmDelete}
                      aria-label={t('common.delete')}
                    >
                      <IconTrash size={20} />
                    </ActionIcon>
                  </Tooltip>
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
            <Alert color="yellow" variant="light">
              {t('playlists.confirmToEdit')}
            </Alert>
          )}
          {editing && (
            <PlaylistSettings
              playlist={playlist}
              onRename={edits.rename}
              onPublic={edits.setPublic}
            />
          )}
          <ErrorText error={remove.error} />

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

function Position({ n, active = false }: { n: number; active?: boolean }) {
  return (
    <Text
      c={active ? 'var(--brand-text)' : 'dimmed'}
      fw={active ? 800 : 600}
      miw="1.25rem"
      ta="right"
      className={classes.number}
    >
      {n}
    </Text>
  );
}

/**
 * Songs in their order, dragged by their grip. Only the grip starts a drag, so scrolling a long
 * list on a phone never reorders it by accident; the keyboard reorders too (Space, arrows).
 */
function SortableSongs({
  songIds,
  songs,
  onEdit,
}: {
  songIds: number[];
  songs: Map<number, SongRecord>;
  onEdit: (op: PlaylistOp) => void;
}) {
  // A song may appear twice; its nth appearance keeps the same key wherever it moves.
  const keys = useMemo(() => {
    const seen = new Map<number, number>();
    return songIds.map((songId) => {
      const n = (seen.get(songId) ?? 0) + 1;
      seen.set(songId, n);
      return `${songId}#${n}`;
    });
  }, [songIds]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    const from = keys.indexOf(String(active.id));
    const to = keys.indexOf(String(over.id));
    onEdit({ type: 'move', songId: songIds[from] as number, from, to });
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={keys} strategy={verticalListSortingStrategy}>
        <Stack gap={0} mx="-md">
          {keys.map((key, index) => {
            const song = songs.get(songIds[index] ?? -1);
            return song ? (
              <SortableRow
                key={key}
                id={key}
                song={song}
                position={index + 1}
                onRemove={() =>
                  onEdit({ type: 'remove', songId: songIds[index] as number, index })
                }
              />
            ) : null;
          })}
        </Stack>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  song,
  position,
  onRemove,
}: {
  id: string;
  song: SongRecord;
  position: number;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={classes.sortableRow}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <ActionIcon
        ref={setActivatorNodeRef}
        variant="subtle"
        color="gray"
        size="xl"
        className={classes.grip}
        aria-label={t('playlists.drag', { title: song.title })}
        {...attributes}
        {...listeners}
      >
        <IconGripVertical size={20} />
      </ActionIcon>
      <Position n={position} />
      <div className={classes.grow}>
        <Group gap={6} wrap="nowrap">
          <Text fw={600} truncate>
            {song.title}
          </Text>
          <StatusBadge status={song.status} />
        </Group>
        {song.artist && (
          <Text size="sm" c="dimmed" truncate>
            {song.artist}
          </Text>
        )}
      </div>
      <ActionIcon
        variant="subtle"
        color="red"
        size="xl"
        onClick={onRemove}
        aria-label={t('playlists.remove')}
      >
        <IconX size={18} />
      </ActionIcon>
    </div>
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
