import { describe, expect, it } from 'vitest';
import { chordIn } from '../chord.ts';
import { parseSong } from '../parse.ts';
import { chordsOf, shapeFor } from '../shapes.ts';

describe('chordIn (D132)', () => {
  it('shows B natural and B flat in the reader’s notation, either way', () => {
    expect(chordIn('B7', 'common', 'german')).toBe('H7');
    expect(chordIn('Bb', 'common', 'german')).toBe('B');
    expect(chordIn('Bbm7/F', 'common', 'german')).toBe('Bm7/F');
    expect(chordIn('H7', 'german', 'common')).toBe('B7');
    expect(chordIn('B', 'german', 'common')).toBe('Bb');
    expect(chordIn('G/H', 'german', 'common')).toBe('G/B');
  });

  it('leaves everything else as written', () => {
    expect(chordIn('A#m', 'common', 'german')).toBe('A#m');
    expect(chordIn('F#7', 'german', 'common')).toBe('F#7');
    expect(chordIn('Ami', 'german', 'common')).toBe('Ami');
    expect(chordIn('N.C.', 'common', 'german')).toBe('N.C.');
    expect(chordIn('B7', 'common', 'common')).toBe('B7');
  });
});

describe('shapeFor (D132)', () => {
  it('finds the common shapes on both instruments', () => {
    expect(shapeFor('C', 'common', 'guitar')).toEqual({
      name: 'C',
      baseFret: 1,
      frets: [null, 3, 2, 0, 1, 0],
      fingers: null,
    });
    expect(shapeFor('Am', 'common', 'ukulele')?.frets).toEqual([2, 0, 0, 0]);
  });

  it('reads Czech spellings: minor as "mi", H as B natural, B as B flat', () => {
    expect(shapeFor('Ami', 'german', 'guitar')?.frets).toEqual(
      shapeFor('Am', 'common', 'guitar')?.frets,
    );
    expect(shapeFor('H7', 'german', 'guitar')?.frets).toEqual(
      shapeFor('B7', 'common', 'guitar')?.frets,
    );
    expect(shapeFor('B', 'german', 'ukulele')?.frets).toEqual(
      shapeFor('Bb', 'common', 'ukulele')?.frets,
    );
  });

  it('finds a slash chord, or else the chord without its bass, named so', () => {
    expect(shapeFor('C/E', 'common', 'guitar')?.name).toBe('C/E');
    expect(shapeFor('C/E', 'common', 'ukulele')?.name).toBe('C');
  });

  it('reads an augmented seventh, and a chord in brackets', () => {
    expect(shapeFor('E7#5', 'common', 'guitar')).not.toBeNull();
    expect(shapeFor('(F#)', 'common', 'guitar')?.frets).toEqual(
      shapeFor('F#', 'common', 'guitar')?.frets,
    );
  });

  it('has nothing for what it doesn’t know, rather than a wrong shape', () => {
    expect(shapeFor('Cwhatever', 'common', 'guitar')).toBeNull();
    expect(shapeFor('N.C.', 'common', 'guitar')).toBeNull();
  });
});

describe('chordsOf', () => {
  it('lists a song’s chords once each, in the order they first come, annotations aside', () => {
    const song = parseSong(
      [
        '{title: T}',
        '{sov}',
        'la [Am]la [*Riff]la [C]la [Am]la',
        '{eov}',
        '{soc}',
        '[G]la',
        '{eoc}',
      ].join('\n'),
    );
    expect(chordsOf(song)).toEqual(['Am', 'C', 'G']);
  });
});
