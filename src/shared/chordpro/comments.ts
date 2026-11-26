import { readDirective } from './parse.ts';

/**
 * A song's own comments, written from the song view (D145): a `{comment}` line in its
 * ChordPro, after the line it's about (`Line.source`), or after the header for the whole song.
 * Only that line is added, changed or removed; the rest of the text stays as it was written.
 */

const COMMENT_DIRECTIVES = new Set(['comment', 'comment_italic', 'comment_box']);

/** A comment is one line: what's typed across lines is joined, as it will be read. */
export function commentText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function linesOf(source: string) {
  return {
    lines: source.split(/\r\n|\r|\n/),
    newline: /\r\n/.test(source) ? '\r\n' : '\n',
  };
}

/** The comment directive on a source line (1-based), or null for any other line. */
function commentAt(lines: string[], at: number) {
  const directive = readDirective((lines[at - 1] ?? '').trim());
  return directive && COMMENT_DIRECTIVES.has(directive.name) ? directive : null;
}

/**
 * Where the song itself starts: the first line that is sung or shapes the sheet (lyrics, a
 * section, a comment, a recalled chorus). Above it, the header: title, artist, key, tags,
 * chord definitions, blank lines.
 */
function bodyStart(lines: string[]): number {
  const index = lines.findIndex((raw) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) {
      return false;
    }
    const directive = readDirective(line);
    if (!directive) {
      return true;
    }
    return (
      COMMENT_DIRECTIVES.has(directive.name) ||
      directive.name === 'highlight' ||
      directive.name === 'chorus' ||
      directive.name === 'column_break' ||
      /^start_of_/.test(directive.name)
    );
  });
  return index === -1 ? lines.length : index;
}

/**
 * Adds `{comment: text}` after source line `after` (1-based), or, with null, at the head of the
 * song, before its first verse, apart from it by a blank line.
 */
export function addComment(source: string, after: number | null, text: string): string {
  const { lines, newline } = linesOf(source);
  const line = `{comment: ${commentText(text)}}`;
  if (after === null) {
    const at = bodyStart(lines);
    lines.splice(at, 0, ...(at < lines.length ? [line, ''] : [line]));
  } else {
    lines.splice(Math.min(after, lines.length), 0, line);
  }
  return lines.join(newline);
}

/** Rewrites the comment on source line `at`, keeping how it's written (`{c:}`, italic, …). */
export function replaceComment(source: string, at: number, text: string): string {
  const { lines, newline } = linesOf(source);
  if (!commentAt(lines, at)) {
    throw new Error(`No comment on line ${at}`);
  }
  const raw = lines[at - 1] ?? '';
  // The directive's own name as written: `c`, `comment_italic`, …
  const written = /^\s*\{\s*([^\s:}]+)/.exec(raw)?.[1] ?? 'comment';
  lines[at - 1] = `{${written}: ${commentText(text)}}`;
  return lines.join(newline);
}

/** Removes the comment on source line `at`. */
export function removeComment(source: string, at: number): string {
  const { lines, newline } = linesOf(source);
  if (!commentAt(lines, at)) {
    throw new Error(`No comment on line ${at}`);
  }
  lines.splice(at - 1, 1);
  // One added at the head of the song came with a blank line: it goes with it.
  if (lines[at - 2]?.trim() === '' && lines[at - 1]?.trim() === '') {
    lines.splice(at - 1, 1);
  }
  return lines.join(newline);
}
