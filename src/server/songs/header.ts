import { parseSong } from '#shared/chordpro/parse.ts';
import { fail } from '../trpc/trpc.ts';

/** Title and artist as the song's own header states them. A song without a title is refused. */
export function readHeader(source: string): { title: string; artist: string | null } {
  const song = parseSong(source);
  const title = song.meta.title?.trim();
  if (!title) {
    fail('BAD_REQUEST', 'SONG_HAS_NO_TITLE');
  }
  return { title, artist: song.artist?.trim() || null };
}
