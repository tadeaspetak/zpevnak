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
import { ActionIcon, Stack, Text } from '@mantine/core';
import { IconGripVertical, IconX } from '@tabler/icons-react';
import { useMemo } from 'react';
import type { PlaylistOp } from '#shared/playlistOps.ts';
import type { SongRecord } from '../data/store.ts';
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
        aria-label={t('playlists.remove')}
      >
        <IconX size={18} />
      </ActionIcon>
    </div>
  );
}
