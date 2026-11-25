import { describe, expect, it } from 'vitest';
import { parseSong } from '../chordpro/parse.ts';
import { notePlaces, placeOf } from '../notes.ts';

const SONG = `{title: Píseň}
{start_of_intro: Předehra}
[A] [D] [E]
{end_of_intro}
{start_of_verse}
la la [D]la
lu lu [A]lu

{c: zpomalit}
{end_of_verse}
{start_of_chorus}
[A]hej hej
{end_of_chorus}
{chorus}
`;

const words = (source: string) =>
  notePlaces(parseSong(source))
    .flat()
    .map((p) => p && [p.place, p.words]);

describe('notePlaces (D135)', () => {
  it('numbers the lines the reader sees, a recalled chorus’s again, and skips empty ones', () => {
    expect(words(SONG)).toEqual([
      [0, 'A D E'],
      [1, 'la la la'],
      [2, 'lu lu lu'],
      null,
      [3, 'zpomalit'],
      [4, 'hej hej'],
      [5, 'hej hej'],
    ]);
  });

  it('reads a line’s words as written: transposing doesn’t move a note', () => {
    expect(words(SONG.replace('[A] [D] [E]', '[A]  [D]   [E]'))[0]).toEqual([0, 'A D E']);
  });
});

describe('placeOf (D135)', () => {
  const places = notePlaces(parseSong(SONG));

  it('keeps a note where its line still is', () => {
    expect(placeOf(places, { index: 2, text: 'lu lu lu' })).toBe(2);
  });

  it('follows its line when the song moved it', () => {
    const longer = notePlaces(
      parseSong(SONG.replace('la la [D]la', 'nový řádek\nla la [D]la')),
    );
    expect(placeOf(longer, { index: 2, text: 'lu lu lu' })).toBe(3);
  });

  it('picks the nearest of lines alike: the chorus it was at, not the first one', () => {
    expect(placeOf(places, { index: 5, text: 'hej hej' })).toBe(5);
    const shorter = notePlaces(parseSong(SONG.replace('la la [D]la\n', '')));
    expect(placeOf(shorter, { index: 5, text: 'hej hej' })).toBe(4);
  });

  it('says a line that’s gone is gone', () => {
    expect(placeOf(places, { index: 1, text: 'jiná slova' })).toBeNull();
  });
});
