import { parseSong } from '#shared/chordpro/parse.ts';
import { fail } from '../trpc/trpc.ts';

type Header = { title: string; artist: string | null };

/** Title and artist as the song's own header states them, or null without a title. */
export function parseHeader(source: string): Header | null {
  const song = parseSong(source);
  const title = song.meta.title?.trim();
  return title ? { title, artist: song.artist?.trim() || null } : null;
}

/** `parseHeader` for a save: a song without a title is refused. */
export function readHeader(source: string): Header {
  return parseHeader(source) ?? fail('BAD_REQUEST', 'SONG_HAS_NO_TITLE');
}
