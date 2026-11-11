import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, Stack, Text } from '@mantine/core';
import { IconGripVertical, IconX } from '@tabler/icons-react';
import { useMemo, useRef } from 'react';
import type { PlaylistOp } from '#shared/playlistOps.ts';
import type { SongRecord } from '../data/store.ts';
import { refocusWithin } from '../focus.ts';
import { useI18n } from '../i18n/index.tsx';
import { SongLabel } from './SongRow.tsx';
import classes from './SortableSongs.module.css';

/** A song's place in the playlist; orange for the one being played. */
export function Position({ n, active = false }: { n: number; active?: boolean }) {
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
export function SortableSongs({
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
  const { t } = useI18n();
  const list = useRef<HTMLDivElement>(null);
  // What a screen reader hears while a song is moved: its title and place, in the reader's
  // language (dnd-kit's own are English, with internal ids).
  const total = keys.length;
  const titleOf = (id: UniqueIdentifier) =>
    songs.get(Number(String(id).split('#')[0]))?.title ?? '';
  const placeOf = (id: UniqueIdentifier | undefined) =>
    id === undefined ? 0 : keys.indexOf(String(id)) + 1;
  const accessibility = {
    screenReaderInstructions: { draggable: t('playlists.dragInstructions') },
    announcements: {
      onDragStart: ({ active }) =>
        t('playlists.dragPicked', {
          title: titleOf(active.id),
          position: placeOf(active.id),
          total,
        }),
      onDragOver: ({ active, over }) =>
        t('playlists.dragOver', {
          title: titleOf(active.id),
          position: placeOf(over?.id ?? active.id),
          total,
        }),
      onDragEnd: ({ active, over }) =>
        t('playlists.dragDropped', {
          title: titleOf(active.id),
          position: placeOf(over?.id ?? active.id),
          total,
        }),
      onDragCancel: ({ active }) =>
        t('playlists.dragCancelled', {
          title: titleOf(active.id),
          position: placeOf(active.id),
        }),
    } satisfies Announcements,
  };
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
      accessibility={accessibility}
    >
      <SortableContext items={keys} strategy={verticalListSortingStrategy}>
        <Stack gap={0} mx="-md" ref={list}>
          {keys.map((key, index) => {
            const song = songs.get(songIds[index] ?? -1);
            return song ? (
              <SortableRow
                key={key}
                id={key}
                song={song}
                position={index + 1}
                onRemove={() => {
                  onEdit({ type: 'remove', songId: songIds[index] as number, index });
                  refocusWithin(list.current);
                }}
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
        size="xl"
        className={classes.grip}
        aria-label={t('playlists.drag', { title: song.title })}
        {...attributes}
        {...listeners}
      >
        <IconGripVertical size={20} />
      </ActionIcon>
      <Position n={position} />
      <SongLabel song={song} />
      <ActionIcon
        color="red"
        size="xl"
        onClick={onRemove}
        aria-label={t('playlists.remove', { title: song.title })}
      >
        <IconX size={18} />
      </ActionIcon>
    </div>
  );
}
