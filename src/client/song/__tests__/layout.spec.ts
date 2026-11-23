import { describe, expect, it } from 'vitest';
import { parseLyricsLine } from '#shared/chordpro/parse.ts';
import { isChordOnly, layoutLine } from '../layout.ts';

const layout = (line: string) => layoutLine(parseLyricsLine(line));

describe('layoutLine', () => {
  it('puts each chord over the start of its word', () => {
    expect(layout('[Am]la la [D]lo')).toEqual([
      [{ chord: 'Am', text: 'la', overhang: true }],
      [{ chord: null, text: 'la' }],
      [{ chord: 'D', text: 'lo' }],
    ]);
  });

  it('keeps a word whole when a chord sits in its middle', () => {
    expect(layout('ka[Am]ra mel')).toEqual([
      [
        { chord: null, text: 'ka' },
        { chord: 'Am', text: 'ra', overhang: true },
      ],
      [{ chord: null, text: 'mel' }],
    ]);
  });

  it('lets a chord reach over the words after it, so a short word isn’t pushed apart', () => {
    const [first] = layout('[C]Z jedné strany, [F]z druhé');
    expect(first).toEqual([{ chord: 'C', text: 'Z', overhang: true }]);
  });

  it('counts the space before the next chord as room', () => {
    expect(layout('andě[G]lé [D]v')[0]).toEqual([
      { chord: null, text: 'andě' },
      { chord: 'G', text: 'lé', overhang: true },
    ]);
  });

  it('keeps a chord’s room when the next chord is too close to reach over', () => {
    expect(layout('[Cmaj7]a [G]b')[0]).toEqual([{ chord: 'Cmaj7', text: 'a' }]);
    expect(layout('[Am]a')[0]).toEqual([{ chord: 'Am', text: 'a' }]);
    expect(
      layout('[A] [D] [E]')
        .flat()
        .some((col) => col.overhang),
    ).toBe(false);
  });

  it('gives a chord over a space a word of its own', () => {
    expect(layout('la [Am] la')).toEqual([
      [{ chord: null, text: 'la' }],
      [{ chord: 'Am', text: '' }],
      [{ chord: null, text: 'la' }],
    ]);
  });

  it('keeps a chord at the end of a word with that word', () => {
    expect(layout('end[E]')).toEqual([
      [
        { chord: null, text: 'end' },
        { chord: 'E', text: '' },
      ],
    ]);
  });

  it('keeps a chord at the end of the line with the last word, so it never wraps alone', () => {
    expect(layout('ten kalich [Dmaj7/A]')).toEqual([
      [{ chord: null, text: 'ten' }],
      [
        { chord: null, text: 'kalich' },
        { chord: null, text: ' ' },
        { chord: 'Dmaj7/A', text: '' },
      ],
    ]);
  });

  it('lays out a chord-only line as separate chords', () => {
    expect(layout('[A] [D] [E]')).toEqual([
      [{ chord: 'A', text: '' }],
      [{ chord: 'D', text: '' }],
      [{ chord: 'E', text: '' }],
    ]);
  });

  it('keeps chords written back to back apart', () => {
    expect(layout('[A][D]la')).toEqual([
      [
        { chord: 'A', text: '' },
        { chord: 'D', text: 'la' },
      ],
    ]);
  });
});

describe('isChordOnly', () => {
  it('is true for chords without words', () => {
    expect(isChordOnly(parseLyricsLine('[A] [D]'))).toBe(true);
    expect(isChordOnly(parseLyricsLine('[A]la'))).toBe(false);
    expect(isChordOnly(parseLyricsLine('la'))).toBe(false);
  });
});
