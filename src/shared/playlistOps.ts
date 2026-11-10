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
export function nearestIndex(songIds: number[], songId: number, index: number): number {
  let best = -1;
  songIds.forEach((id, i) => {
    if (id === songId && (best === -1 || Math.abs(i - index) < Math.abs(best - index))) {
      best = i;
    }
  });
  return best;
}

/**
 * The playlist's songs after `op`, applied the same way on the device (at once) and on the
 * server (for real). A song someone else already took out is left as it is.
 */
export function applyOp(songIds: number[], op: PlaylistOp): number[] {
  if (op.type === 'add') {
    return [...songIds, op.songId];
  }
  const at = nearestIndex(songIds, op.songId, op.type === 'remove' ? op.index : op.from);
  if (at === -1) {
    return songIds;
  }
  const without = songIds.filter((_, i) => i !== at);
  if (op.type === 'remove') {
    return without;
  }
  const to = Math.max(0, Math.min(without.length, op.to));
  return [...without.slice(0, to), op.songId, ...without.slice(to)];
}
