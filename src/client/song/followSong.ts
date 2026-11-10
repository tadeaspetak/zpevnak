import { nearestIndex } from '#shared/playlistOps.ts';

/**
 * Where the song being played is now, after the playlist changed under it (someone else
 * added, moved or removed songs). `position` counts from 1. Taken out of the playlist, the
 * song stays where it was, flagged `removed`.
 */
export function followSong(
  songIds: number[],
  songId: number,
  position: number,
): { position: number; removed: boolean } {
  if (songIds[position - 1] === songId) {
    return { position, removed: false };
  }
  const index = nearestIndex(songIds, songId, position - 1);
  return index === -1
    ? { position, removed: true }
    : { position: index + 1, removed: false };
}

/**
 * The positions previous and next go to, from `position` (counting from 1), and the song next
 * goes to. A removed song's place is taken by the one that followed it: that one is next.
 */
export function playlistSteps(
  songIds: number[],
  position: number,
  removed: boolean,
): { prev: number | null; next: number | null; nextSongId: number | null } {
  const after = removed ? position : position + 1;
  const next = after <= songIds.length ? after : null;
  return {
    prev: position > 1 ? position - 1 : null,
    next,
    nextSongId: next === null ? null : (songIds[next - 1] ?? null),
  };
}
