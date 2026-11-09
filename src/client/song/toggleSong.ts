/**
 * Adds the song to the end of the playlist, or, when it is already in, takes out its last
 * appearance: a song put in twice on purpose keeps its earlier place.
 */
export function toggleSong(songIds: number[], songId: number): number[] {
  const last = songIds.lastIndexOf(songId);
  return last === -1 ? [...songIds, songId] : songIds.filter((_, i) => i !== last);
}
