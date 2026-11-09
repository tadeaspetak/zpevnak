import { describe, expect, it } from 'vitest';
import { parseChord, spellingForKey, transposeChord, transposeKey } from '../chord.ts';

describe('parseChord', () => {
  it.each([
    ['Am', { root: 'A', suffix: 'm', bass: null }],
    ['F#m7+/F', { root: 'F#', suffix: 'm7+', bass: 'F' }],
    ['Bbmaj7', { root: 'Bb', suffix: 'maj7', bass: null }],
    ['Hm7', { root: 'H', suffix: 'm7', bass: null }],
    ['Dmaj7/A', { root: 'D', suffix: 'maj7', bass: 'A' }],
    ['Aaddb9*', { root: 'A', suffix: 'addb9*', bass: null }],
  ])('reads %s', (name, expected) => {
    expect(parseChord(name)).toEqual(expected);
  });

  it.each(['N.C.', 'x', '|', '%', '', '*Intro'])('treats %j as not a chord', (name) => {
    expect(parseChord(name)).toBeNull();
  });
});

describe('transposeChord', () => {
  it('keeps the suffix and moves the bass', () => {
    expect(transposeChord('Dmaj7/A', 2, 'common')).toBe('Emaj7/B');
  });

  it('leaves non-chords alone', () => {
    expect(transposeChord('N.C.', 3, 'common')).toBe('N.C.');
  });

  it('wraps around the octave in both directions', () => {
    expect(transposeChord('A', 3, 'common')).toBe('C');
    expect(transposeChord('C', -1, 'common')).toBe('B');
    expect(transposeChord('E', 12, 'common')).toBe('E');
  });

  describe('german notation (Czech songs)', () => {
    it('reads H as B natural and B as B flat', () => {
      expect(transposeChord('H', 1, 'german')).toBe('C');
      expect(transposeChord('B', 2, 'german')).toBe('C');
    });

    it('writes B natural as H and B flat as B', () => {
      expect(transposeChord('A', 2, 'german')).toBe('H');
      expect(transposeChord('A', 1, 'german')).toBe('B');
      expect(transposeChord('Hm7', 2, 'german')).toBe('C#m7');
    });

    it('treats a written Bb as B flat, not a double flat', () => {
      expect(transposeChord('Bb', 2, 'german')).toBe('C');
    });
  });

  it('in common notation, B is B natural', () => {
    expect(transposeChord('B7', 1, 'common')).toBe('C7');
    expect(transposeChord('A', 2, 'common')).toBe('B');
  });

  it('uses the spelling table it is given', () => {
    expect(transposeChord('C', 1, 'common', spellingForKey('F', 'common'))).toBe('Db');
    expect(transposeChord('C', 1, 'common', spellingForKey('A', 'common'))).toBe('C#');
  });
});

describe('spellingForKey', () => {
  it('uses flats in flat keys, including their relative minors', () => {
    expect(spellingForKey('Eb', 'common')[8]).toBe('Ab');
    expect(spellingForKey('Dm', 'common')[10]).toBe('Bb');
  });

  it('uses sharps in sharp keys', () => {
    expect(spellingForKey('E', 'common')[8]).toBe('G#');
    expect(spellingForKey('C#m', 'common')[8]).toBe('G#');
  });

  it('treats maj as major, not minor', () => {
    expect(spellingForKey('Dmaj7', 'common')[6]).toBe('F#');
  });
});

describe('transposeKey', () => {
  it('spells the new key for itself', () => {
    expect(transposeKey('G', 1, 'common')).toBe('Ab');
    expect(transposeKey('Dm', 2, 'german')).toBe('Em');
    expect(transposeKey('A', 2, 'german')).toBe('H');
  });
});
