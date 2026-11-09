import { describe, expect, it } from 'vitest';
import { parseLyricsLine } from '#shared/chordpro/parse.ts';
import { isChordOnly, layoutLine } from '../layout.ts';

const layout = (line: string) => layoutLine(parseLyricsLine(line));

describe('layoutLine', () => {
  it('puts each chord over the start of its word', () => {
    expect(layout('[Am]la la [D]lo')).toEqual([
      [{ chord: 'Am', text: 'la' }],
      [{ chord: null, text: 'la' }],
      [{ chord: 'D', text: 'lo' }],
    ]);
  });

  it('keeps a word whole when a chord sits in its middle', () => {
    expect(layout('ka[Am]ra mel')).toEqual([
      [
        { chord: null, text: 'ka' },
        { chord: 'Am', text: 'ra' },
      ],
      [{ chord: null, text: 'mel' }],
    ]);
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
