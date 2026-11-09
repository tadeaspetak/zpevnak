import type { Segment } from '#shared/chordpro/types.ts';

/** A chord and the text under it. */
type Column = { chord: string | null; text: string };
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
  return words;
}

export function hasChords(segments: Segment[]): boolean {
  return segments.some((s) => s.chord !== null);
}

/** A line of chords with no words under them, like an intro. */
export function isChordOnly(segments: Segment[]): boolean {
  return hasChords(segments) && segments.every((s) => s.text.trim() === '');
}
