import { parseSong } from '#shared/chordpro/parse.ts';
import { tidySource } from '#shared/chordpro/tidy.ts';
import { fail } from '../trpc/trpc.ts';

type Header = { title: string; artist: string | null };

/** Title and artist as the song's own header states them, or null without a title. */
export function parseHeader(source: string): Header | null {
  const song = parseSong(source);
  const title = song.meta.title?.trim();
  return title ? { title, artist: song.artist?.trim() || null } : null;
}

/**
 * A song's text as a save stores it, written the one way the songbook writes it (D150), and the
 * title and artist read from it. A song without a title is refused.
 */
export function readForSave(source: string): Header & { source: string } {
  const tidied = tidySource(source).source;
  const header = parseHeader(tidied) ?? fail('BAD_REQUEST', 'SONG_HAS_NO_TITLE');
  return { ...header, source: tidied };
}
