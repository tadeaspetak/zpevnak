import { describe, expect, it } from 'vitest';
import { artistIn, setArtist } from '../artist.ts';

const text = (...lines: string[]) => lines.join('\n');

describe('artistIn', () => {
  it('reads the artist the text states, several as the song shows them, a subtitle not', () => {
    expect(artistIn(text('{title: Lala}', '{artist: Někdo}'))).toBe('Někdo');
    expect(artistIn(text('{artist: Někdo}', '{meta: artist Jiný}'))).toBe('Někdo, Jiný');
    expect(artistIn(text('{title: Lala}', '{subtitle: z filmu}'))).toBe('');
  });
});

describe('setArtist', () => {
  it('rewrites the artist line where it is', () => {
    expect(setArtist(text('{title: Lala}', '{key: G}', '{artist: Někdo}'), 'Jiný')).toBe(
      text('{title: Lala}', '{key: G}', '{artist: Jiný}'),
    );
  });

  it('makes several artist lines one, said where the first was', () => {
    expect(
      setArtist(text('{artist: Někdo}', '{title: Lala}', '{artist: Jiný}'), 'Oba'),
    ).toBe(text('{artist: Oba}', '{title: Lala}'));
  });

  it('adds one after the title, or at the end of the header', () => {
    expect(setArtist(text('{title: Lala}', '{key: G}', '', 'la la'), 'Někdo')).toBe(
      text('{title: Lala}', '{artist: Někdo}', '{key: G}', '', 'la la'),
    );
    expect(setArtist(text('{key: G}', '', 'la la'), 'Někdo')).toBe(
      text('{key: G}', '{artist: Někdo}', '', 'la la'),
    );
  });

  it('leaves an emptied artist to be filled in, and keeps line ends', () => {
    expect(setArtist(text('{title: Lala}', '{artist: Někdo}'), '')).toBe(
      text('{title: Lala}', '{artist: }'),
    );
    expect(setArtist('{title: Lala}\r\n{artist: A}', 'B')).toBe(
      '{title: Lala}\r\n{artist: B}',
    );
  });
});
