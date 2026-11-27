import { isHeaderLine, parseSong, readDirective } from './parse.ts';

/** A line stating the artist: `{artist: …}`, or `{meta: artist …}`. */
function isArtistLine(line: string): boolean {
  const directive = line.trim().startsWith('{') ? readDirective(line.trim()) : null;
  return (
    directive?.name === 'artist' ||
    (directive?.name === 'meta' && /^artist(?:\s|$)/.test(directive.value))
  );
}

/** The artist as the song's text states it, several joined as the song shows them (D152). */
export function artistIn(source: string): string {
  return parseSong(source).meta.artists.join(', ');
}

/**
 * The source with `artist` as its artist, changed as little as possible: the first artist line
 * says it and any others go; without one, it goes after the title, or else at the end of the
 * header. Left empty, the line stays as `{artist: }`, to be filled in (the template's way).
 */
export function setArtist(source: string, artist: string): string {
  const newline = /\r\n/.test(source) ? '\r\n' : '\n';
  const wanted = `{artist: ${artist.trim()}}`;
  const lines: string[] = [];
  let written = false;
  let titleAt: number | null = null;
  let headerEnd = 0;
  let inHeader = true;
  for (const line of source.split(/\r\n|\r|\n/)) {
    if (isArtistLine(line)) {
      if (!written) {
        lines.push(wanted);
        written = true;
      }
      continue;
    }
    lines.push(line);
    if (readDirective(line.trim())?.name === 'title') {
      titleAt = lines.length;
    }
    if (inHeader) {
      if (isHeaderLine(line)) {
        headerEnd = lines.length;
      } else if (
        line.trim() !== '' &&
        !line.trim().startsWith('#') &&
        !line.trim().startsWith('{')
      ) {
        inHeader = false;
      }
    }
  }
  if (!written) {
    lines.splice(titleAt ?? headerEnd, 0, wanted);
  }
  return lines.join(newline);
}
