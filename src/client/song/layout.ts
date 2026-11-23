import type { Segment } from '#shared/chordpro/types.ts';

/**
 * A chord and the text under it. `overhang`: the chord is wider than its text but may reach over
 * the text after it, since the next chord is far enough away; the column keeps its text's width,
 * so a short word under a chord ("[C]Z jedné") isn't pushed apart from the next.
 */
type Column = { chord: string | null; text: string; overhang?: true };
/** Columns that must stay on one line: a word, even when a chord sits mid-word. */
export type Word = Column[];

/**
 * Lays a lyrics line out as words, so the browser can wrap between words but never inside
 * one, and a chord always stays over its syllable.
 */
export function layoutLine(segments: Segment[]): Word[] {
  const words: Word[] = [];
  let word: Word = [];
  const endWord = () => {
    if (word.length > 0) {
      words.push(word);
      word = [];
    }
  };

  for (const { chord, text } of segments) {
    const [first = '', ...rest] = text.split(/(\s+)/);
    if (chord !== null) {
      if (first === '' && word.length > 0 && text !== '') {
        // A chord over a space ("la [Am] la") stands alone, not glued to the word before.
        endWord();
      }
      word.push({ chord, text: first });
    } else if (first !== '') {
      word.push({ chord: null, text: first });
    }
    for (const part of rest) {
      if (/^\s+$/.test(part)) {
        endWord();
      } else if (part !== '') {
        word.push({ chord: null, text: part });
      }
    }
  }
  endWord();
  // A chord at the very end of the line rides with the last word: alone, it would wrap onto
  // a line of its own on a phone.
  const last = words.at(-1);
  const beforeLast = words.at(-2);
  const chordOnly = (word: Word | undefined) =>
    word?.every((col) => col.chord !== null && col.text === '') ?? false;
  if (beforeLast && !chordOnly(beforeLast) && chordOnly(last)) {
    words.splice(-2, 2, [...beforeLast, { chord: null, text: ' ' }, ...(last as Word)]);
  }
  markOverhangs(words);
  return words;
}

/**
 * Characters a chord may overhang beyond its own: its padding, and one more, because the font
 * is proportional and a count of characters only estimates their width.
 */
const OVERHANG_MARGIN = 2;

function markOverhangs(words: Word[]) {
  const columns = words.flatMap((word, w) =>
    word.map((col, c) => ({ col, startsWord: c === 0 && w > 0 })),
  );
  columns.forEach(({ col }, i) => {
    // A bold chord and its padding outgrow plain text of one more character too.
    if (col.chord === null || col.text.length > col.chord.length + 1) {
      return;
    }
    // The text from this chord to the next one: what the chord could reach over.
    let room = col.text.length;
    for (const next of columns.slice(i + 1)) {
      // The space before a word is room too, also when the next chord starts that word.
      room += next.startsWord ? 1 : 0;
      if (next.col.chord !== null) {
        break;
      }
      room += next.col.text.length;
    }
    if (room >= col.chord.length + OVERHANG_MARGIN) {
      col.overhang = true;
    }
  });
}

export function hasChords(segments: Segment[]): boolean {
  return segments.some((s) => s.chord !== null);
}

/** A line of chords with no words under them, like an intro. */
export function isChordOnly(segments: Segment[]): boolean {
  return hasChords(segments) && segments.every((s) => s.text.trim() === '');
}
