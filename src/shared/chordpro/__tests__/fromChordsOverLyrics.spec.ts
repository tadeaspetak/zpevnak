import { describe, expect, it } from 'vitest';
import {
  fromChordsOverLyrics,
  isChordLine,
  looksLikeChordsOverLyrics,
  mergeChordLine,
} from '../fromChordsOverLyrics.ts';
import { parseSong } from '../parse.ts';

const text = (...lines: string[]) => lines.join('\n');

describe('isChordLine', () => {
  it('takes a line of chords, with bar lines and repeats between them', () => {
    expect(isChordLine('C    G/H   Am7')).toBe(true);
    expect(isChordLine('| Dmaj7 | Hm | Fis | x2')).toBe(true);
    expect(isChordLine('  Esus4  (E)  ')).toBe(true);
  });

  it('refuses words that start like a chord', () => {
    expect(isChordLine('Ahoj Bedo')).toBe(false);
    expect(isChordLine('A tak jdem')).toBe(false);
    expect(isChordLine('Dej mi')).toBe(false);
    expect(isChordLine('')).toBe(false);
    expect(isChordLine('| x2 |')).toBe(false);
  });
});

describe('looksLikeChordsOverLyrics', () => {
  it('spots chords on a line of their own', () => {
    expect(looksLikeChordsOverLyrics(text('C     G', 'la la la'))).toBe(true);
  });

  it('leaves ChordPro alone, tab sections and directives included', () => {
    expect(looksLikeChordsOverLyrics(text('{title: x}', '[C]la la [G]la'))).toBe(false);
    expect(looksLikeChordsOverLyrics(text('{sot}', 'A  D  E', '{eot}'))).toBe(false);
  });
});

describe('mergeChordLine', () => {
  it('puts each chord before the letter it stood above', () => {
    expect(mergeChordLine('C     G', 'la la la lo')).toBe('[C]la la [G]la lo');
  });

  it('keeps chords that run past the end of the words', () => {
    expect(mergeChordLine('C        G', 'la la')).toBe('[C]la la    [G]');
  });

  it('counts a tab as the columns it moves to', () => {
    expect(mergeChordLine('\tG', 'la la la lo')).toBe('la la la[G] lo');
  });

  it('drops bar lines and unwraps chords in brackets', () => {
    expect(mergeChordLine('|  C  | (G)', 'la la la lo la')).toBe('la [C]la la [G]lo la');
  });
});

describe('fromChordsOverLyrics', () => {
  it('turns a pasted song into ChordPro, heading and sections included', () => {
    const pasted = text(
      'Lesní píseň',
      'Kapela Mech',
      '',
      'Capo 2',
      '',
      '[Verse 1]',
      'C     G',
      'la la la lo',
      'Am    F',
      'lo li la',
      '',
      '[Chorus]',
      'F  C',
      'ha ha ha',
    );
    expect(fromChordsOverLyrics(pasted)).toBe(
      text(
        '{title: Lesní píseň}',
        '{artist: Kapela Mech}',
        '',
        '{capo: 2}',
        '',
        '{start_of_verse: Verse 1}',
        '[C]la la [G]la lo',
        '[Am]lo li [F]la',
        '{end_of_verse}',
        '',
        '{start_of_chorus: Chorus}',
        '[F]ha [C]ha ha',
        '{end_of_chorus}',
        '',
      ),
    );
  });

  it('reads Czech section names and numbered verses', () => {
    const out = fromChordsOverLyrics(
      text('{title: x}', '1.', 'D', 'la', 'R:', 'G', 'lo'),
    );
    expect(out).toContain('{start_of_verse: 1.}\n[D]la\n{end_of_verse}');
    expect(out).toContain('{start_of_chorus: R}\n[G]lo\n{end_of_chorus}');
  });

  it('turns an intro of chords alone into chords without words', () => {
    const out = fromChordsOverLyrics(
      text('{title: x}', 'Intro:', 'C  G  C', '', 'C', 'la'),
    );
    expect(out).toBe(
      text('{title: x}', '{comment: Intro}', '[C]  [G]  [C]', '', '[C]la', ''),
    );
  });

  it('keeps what is ChordPro already, and adds no heading when there is a title', () => {
    const source = text('{title: x}', '{artist: y}', '', '[C]la la', 'G', 'lo lo');
    expect(fromChordsOverLyrics(source)).toBe(
      text('{title: x}', '{artist: y}', '', '[C]la la', '[G]lo lo', ''),
    );
  });

  it('does not take the first verse for a title', () => {
    const out = fromChordsOverLyrics(text('C', 'la la', 'G', 'lo lo'));
    expect(out).toBe(text('[C]la la', '[G]lo lo', ''));
  });

  it('gives a song the parser reads without leftover chord lines', () => {
    const song = parseSong(
      fromChordsOverLyrics(text('Píseň', '', 'Em    D', 'la la la', '', 'C', 'lo')),
    );
    expect(song.meta.title).toBe('Píseň');
    expect(song.warnings).toEqual([]);
    expect(looksLikeChordsOverLyrics(fromChordsOverLyrics(text('Em', 'la')))).toBe(false);
  });
});
