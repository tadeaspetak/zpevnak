/**
 * Where a note on a song sits (D135). A note keeps its line's place (its position among the
 * lines the reader sees, a recalled chorus's again) and the line's words, so it can be found
 * again after the song is edited: where both still match; else at the nearest line with the
 * same words (a verse added above moved it); else, never lost, at the top, marked as moved.
 */
import type { Line, Song } from './chordpro/types.ts';

/** Kept to what a note stores of its line (`noteLineTextSchema`). */
const MAX_WORDS = 500;

/**
 * A line a note can be at: its place, and its words. For a comment written into the song from
 * here (D145): the source line it goes above (`before`: the line itself, D146; in a recalled
 * chorus, the `{chorus}` line, so it isn't copied into every repeat), and, a line that is the
 * song's own comment, its source line (`comment`), to change or remove it.
 */
export type NotePlace = {
  place: number;
  words: string;
  before: number;
  comment: number | null;
};

/**
 * A line's words, as a note remembers them: the lyrics without chords; a line of chords alone
 * (an intro), its chords; a comment or a tab, its text. An empty line has none, and takes no
 * note. Read from the song as written, never transposed: a transposed intro is the same line.
 */
function lineWords(line: Line): string {
  const tidy = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, MAX_WORDS);
  if (line.type !== 'lyrics') {
    return tidy(line.text);
  }
  return (
    tidy(line.segments.map((s) => s.text).join('')) ||
    tidy(line.segments.map((s) => s.chord ?? '').join(' '))
  );
}

/**
 * Every line of the song as the reader sees it, block by block, line by line (a recalled
 * chorus's lines with it), with its place, or null for an empty line.
 */
export function notePlaces(song: Song): (NotePlace | null)[][] {
  let place = 0;
  return song.blocks.map((block) => {
    const recalled = block.type === 'chorusRecall';
    const lines =
      block.type === 'section'
        ? block.lines
        : recalled && block.chorus?.type === 'section'
          ? block.chorus.lines
          : [];
    return lines.map((line) => {
      const words = lineWords(line);
      return words
        ? {
            place: place++,
            words,
            before: recalled ? block.line : line.source,
            comment: line.type === 'comment' ? line.source : null,
          }
        : null;
    });
  });
}

/** How alike two lines' words are, 0 to 1: one less the edits between them, per letter. */
export function likeness(a: string, b: string): number {
  if (a === b) {
    return 1;
  }
  // Levenshtein distance, one row at a time.
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = row;
  }
  return 1 - (previous[b.length] ?? 0) / Math.max(a.length, b.length);
}

/** Words this alike are the same line, edited a little: a typo fixed, a comma added. */
const SAME_LINE = 0.8;

/**
 * Where `line` (a note's) is now among `places`: its place, or null when it's gone. Its very
 * words first, at its place or the nearest one (a verse added above moved it); else words
 * nearly the same (a typo fixed there), the nearest again.
 */
export function placeOf(
  places: readonly (NotePlace | null)[][],
  line: { index: number; text: string },
): number | null {
  const all = places.flat().filter((p): p is NotePlace => p !== null);
  const nearest = (lines: NotePlace[]) =>
    lines.sort(
      (a, b) => Math.abs(a.place - line.index) - Math.abs(b.place - line.index),
    )[0]?.place ?? null;
  return (
    nearest(all.filter((p) => p.words === line.text)) ??
    nearest(all.filter((p) => likeness(p.words, line.text) >= SAME_LINE))
  );
}
