/**
 * Where a note on a song sits (D135). A note keeps its line's place (its position among the
 * lines the reader sees, a recalled chorus's again) and the line's words, so it can be found
 * again after the song is edited: where both still match; else at the nearest line with the
 * same words (a verse added above moved it); else, never lost, at the top, marked as moved.
 */
import type { Line, Song } from './chordpro/types.ts';

/** Kept to what a note stores of its line (`noteLineTextSchema`). */
const MAX_WORDS = 500;

/** A line a note can be at: its place, and its words. */
export type NotePlace = { place: number; words: string };

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
    const lines =
      block.type === 'section'
        ? block.lines
        : block.type === 'chorusRecall' && block.chorus?.type === 'section'
          ? block.chorus.lines
          : [];
    return lines.map((line) => {
      const words = lineWords(line);
      return words ? { place: place++, words } : null;
    });
  });
}

/** Where `line` (a note's) is now among `places`: its place, or null when it's gone. */
export function placeOf(
  places: readonly (NotePlace | null)[][],
  line: { index: number; text: string },
): number | null {
  const all = places.flat().filter((p): p is NotePlace => p !== null);
  if (all[line.index]?.words === line.text) {
    return line.index;
  }
  const same = all.filter((p) => p.words === line.text);
  same.sort((a, b) => Math.abs(a.place - line.index) - Math.abs(b.place - line.index));
  return same[0]?.place ?? null;
}
