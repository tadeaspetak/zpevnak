/**
 * Edits to a playlist's song order, as small operations rather than a whole new list, so two
 * people editing at once both keep their changes. The server applies them to the current list;
 * a device applies the same function to show the change at once.
 *
 * Each operation names its song as well as where the editor saw it. If someone else's edit has
 * shifted the list meanwhile, it acts on that song's nearest appearance, never on whatever song
 * now happens to sit at the old index. Indexes count from 0.
 */
export type PlaylistOp =
  | { type: 'add'; songId: number }
  | { type: 'remove'; songId: number; index: number }
  | { type: 'move'; songId: number; from: number; to: number };

/** The appearance of the song nearest to `index` (the earlier one on a tie), or -1. */
export function nearestIndex<T>(
  items: T[],
  songId: number,
  index: number,
  songIdOf: (item: T) => number = (item) => item as unknown as number,
): number {
  let best = -1;
  items.forEach((item, i) => {
    if (
      songIdOf(item) === songId &&
      (best === -1 || Math.abs(i - index) < Math.abs(best - index))
    ) {
      best = i;
    }
  });
  return best;
}

/**
 * `applyOp` on any kind of list entry: `songIdOf` reads an entry's song, `make` makes the entry
 * an added song gets. The server uses entries that remember where hidden songs sat.
 */
function applyOpTo<T>(
  items: T[],
  op: PlaylistOp,
  songIdOf: (item: T) => number,
  make: (songId: number) => T,
): T[] {
  if (op.type === 'add') {
    return [...items, make(op.songId)];
  }
  const at = nearestIndex(
    items,
    op.songId,
    op.type === 'remove' ? op.index : op.from,
    songIdOf,
  );
  if (at === -1) {
    // Someone else already took it out: nothing left to do.
    return items;
  }
  const without = items.filter((_, i) => i !== at);
  if (op.type === 'remove') {
    return without;
  }
  const to = Math.max(0, Math.min(without.length, op.to));
  return [...without.slice(0, to), items[at] as T, ...without.slice(to)];
}

export function applyOp(songIds: number[], op: PlaylistOp): number[] {
  return applyOpTo(
    songIds,
    op,
    (id) => id,
    (id) => id,
  );
}
