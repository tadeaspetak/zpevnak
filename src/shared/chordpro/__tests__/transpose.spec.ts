import { describe, expect, it } from 'vitest';
import { parseSong } from '../parse.ts';
import { songPitch, transposeSong, transposeSource } from '../transpose.ts';

const text = (...lines: string[]) => lines.join('\n');

describe('transposeSource', () => {
  it('moves every chord and the key, and nothing else', () => {
    const source = text(
      '{title: Píseň [A]}',
      '{key: A}',
      '# [A] a remark',
      '',
      '[A]la la [D]la, [E7/G#]lo [N.C.]',
      '{comment: [A] stays}',
    );
    expect(transposeSource(source, 3)).toBe(
      text(
        '{title: Píseň [A]}',
        '{key: C}',
        '# [A] a remark',
        '',
        '[C]la la [F]la, [G7/B]lo [N.C.]',
        '{comment: [A] stays}',
      ),
    );
  });

  it('keeps the song’s notation: B is B flat in a Czech song', () => {
    const source = text('{+notes.system: german}', '[F]la [B]la [C]la [H]lo');
    expect(transposeSource(source, -5)).toBe(
      text('{+notes.system: german}', '[C]la [F]la [G]la [F#]lo'),
    );
  });

  it('leaves tabs and grids as written', () => {
    const source = text('{sot}', 'e|--[A]--|', '{eot}', '[A]la');
    expect(transposeSource(source, 2)).toBe(
      text('{sot}', 'e|--[A]--|', '{eot}', '[B]la'),
    );
  });

  it('drops chord diagrams: they are fingerings for the old chords', () => {
    const source = text('{define: Aadd9 base-fret 1 frets x 0 2 4 2 x}', '[Aadd9]la');
    expect(transposeSource(source, 3)).toBe('[Cadd9]la');
  });

  it('keeps the formatting of the key line and the line endings', () => {
    expect(transposeSource('{key:Dm}\r\n[Dm]la', 2)).toBe('{key:Em}\r\n[Em]la');
  });

  it('changes nothing for a whole octave', () => {
    const source = text('{define: A base-fret 1 frets x 0 2 2 2 0}', '[A]la');
    expect(transposeSource(source, 12)).toBe(source);
  });

  it('writes what the transposed view shows', () => {
    const source = text(
      '{title: Píseň}',
      '{key: Hm}',
      '{start_of_chorus}',
      '[Hm]la [G]la [D/F#]la [A]lo',
      '{end_of_chorus}',
      '{chorus}',
      '[Em]na [F#7]na',
    );
    for (const semitones of [-5, 1, 3, 7]) {
      const shown = transposeSong(parseSong(source), semitones);
      const saved = parseSong(transposeSource(source, semitones));
      expect(saved.blocks).toEqual(shown.blocks);
      expect(saved.meta.key).toBe(shown.meta.key);
    }
  });
});

describe('songPitch', () => {
  it('is the key’s root, or else the first chord’s', () => {
    expect(songPitch(parseSong('{key: Dm}\n[A]la'))).toBe(2);
    expect(songPitch(parseSong('la\n[N.C.]la [F#m]lo'))).toBe(6);
    expect(songPitch(parseSong('{+notes.system: german}\n[B]la'))).toBe(10);
    expect(songPitch(parseSong('la la'))).toBeNull();
  });
});
