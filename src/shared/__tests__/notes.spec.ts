import { describe, expect, it } from 'vitest';
import { parseSong } from '../chordpro/parse.ts';
import { likeness, notePlaces, placeOf } from '../notes.ts';

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

  it('says where a song comment written at a line goes, and which lines are one (D145)', () => {
    const at = notePlaces(parseSong(SONG))
      .flat()
      .map((p) => p && [p.after, p.comment]);
    expect(at).toEqual([
      [3, null],
      [6, null],
      [7, null],
      null,
      // The song's own comment: changed where it is.
      [9, 9],
      [12, null],
      // In a recalled chorus, after the {chorus}: not copied into every repeat.
      [14, null],
    ]);
  });

  it('moves the notes below a new song comment a place, and finds them again by their words', () => {
    const places = notePlaces(parseSong(SONG));
    const commented = notePlaces(
      parseSong(SONG.replace('la la [D]la', 'la la [D]la\n{comment: tiše}')),
    );
    expect(placeOf(places, { index: 2, text: 'lu lu lu' })).toBe(2);
    expect(placeOf(commented, { index: 2, text: 'lu lu lu' })).toBe(3);
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

  it('stays with its line through a small edit: a letter fixed', () => {
    const fixed = notePlaces(parseSong(SONG.replace('lu lu [A]lu', 'lu lu [A]lů')));
    expect(placeOf(fixed, { index: 2, text: 'lu lu lu' })).toBe(2);
  });

  it('prefers its very words moved over a line merely like them', () => {
    const moved = notePlaces(
      parseSong(SONG.replace('la la [D]la', 'lu lu lo\nla la [D]la')),
    );
    // "lu lu lo" is like it, where it was; its own words are a line further down.
    expect(placeOf(moved, { index: 1, text: 'lu lu lu' })).toBe(3);
  });

  it('says a line that’s gone is gone', () => {
    expect(placeOf(places, { index: 1, text: 'jiná slova' })).toBeNull();
  });
});

describe('likeness', () => {
  it('is 1 for the same words, high for a typo, low for another line', () => {
    expect(likeness('la la la', 'la la la')).toBe(1);
    expect(likeness('jistě rozezná', 'jiste rozezná')).toBeGreaterThan(0.9);
    // A line of a song, a comma added and a letter fixed: still the same line.
    expect(
      likeness(
        'a ticho šumělo a vonělo celou noc',
        'a ticho šumělo, a vonělo celou noc!',
      ),
    ).toBeGreaterThan(0.9);
    expect(likeness('la la la', 'hej hej')).toBeLessThan(0.5);
  });
});
