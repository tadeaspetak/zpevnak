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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ActionIcon,
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
  IconX,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ErrorText } from '../components/ErrorText.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { SongPicker } from '../components/SongPicker.tsx';
import { SongRow } from '../components/SongRow.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { putPlaylist, syncCatalog, useCatalog } from '../data/catalog.ts';
import { leavePlaylist, usePlayer } from '../data/session.ts';
import type { PlaylistRecord, SongRecord } from '../data/store.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { toggleSong } from '../song/toggleSong.ts';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';
import classes from './PlaylistPage.module.css';

export function PlaylistPage() {
  const { t, tn } = useI18n();
  const navigate = useNavigate();
  const id = Number(useParams().id);
  const { playlists, songs, loaded } = useCatalog();
  const { session } = usePlayer();
  const { me } = useMe();
  const playlist = playlists.get(id);
  const [editing, setEditing] = useState(false);
  const [adding, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const [confirmingDelete, { open: confirmDelete, close: cancelDelete }] =
    useDisclosure(false);

  const update = trpc.playlists.update.useMutation({
    onSuccess: (p) => putPlaylist(p.id, p),
    // The device showed the change before the server had it; take the server's word again.
    onError: () => void syncCatalog(me?.id ?? null),
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

  /** Shows the new order at once and saves it behind the scenes. */
  const setSongIds = (songIds: number[]) => {
    putPlaylist(id, { ...playlist, songIds });
    update.mutate({ id, songIds });
  };
  const currentPosition = session?.playlistId === id ? session.position : null;

  return (
    <>
      <PageHeader
        title={playlist.name}
        backTo={url.playlists()}
        backLabel={backLabel}
        actions={
          playlist.isMine && (
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
            </>
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
          </Group>

          {editing && <PlaylistSettings playlist={playlist} />}
          <ErrorText error={update.error ?? remove.error} />

          {playlist.songIds.length === 0 && (
            <Center py="xl">
              <Stack align="center" gap="sm">
                <Text c="dimmed">{t('playlists.empty')}</Text>
                {playlist.isMine && !editing && (
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
            <SortableSongs
              songIds={playlist.songIds}
              songs={songs}
              onChange={setSongIds}
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
                    to={url.playlistSong(id, position)}
                    active={currentPosition === position}
                    leading={<Position n={position} />}
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
        songIds={playlist.songIds}
        onToggle={(songId) => setSongIds(toggleSong(playlist.songIds, songId))}
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

function Position({ n }: { n: number }) {
  return (
    <Text c="dimmed" fw={600} miw="1.25rem" ta="right" className={classes.number}>
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
  onChange,
}: {
  songIds: number[];
  songs: Map<number, SongRecord>;
  onChange: (songIds: number[]) => void;
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
    onChange(arrayMove(songIds, from, to));
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
                onRemove={() => onChange(songIds.filter((_, i) => i !== index))}
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
