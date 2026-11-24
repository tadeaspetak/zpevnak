import { describe, expect, it } from 'vitest';
import type { SongRecord } from '../store.ts';
import { byline, keyUnder } from '../songText.ts';

describe('byline (D120)', () => {
  it('shows the artist, then the tags after a pipe', () => {
    expect(byline('Lucie Bílá', ['Pohádky'])).toBe('Lucie Bílá | Pohádky');
    expect(byline('Lucie Bílá', ['Pohádky', 'Lidové'])).toBe(
      'Lucie Bílá | Pohádky, Lidové',
    );
  });

  it('shows the tags alone without an artist, the artist alone without tags', () => {
    expect(byline(null, ['Koledy'])).toBe('Koledy');
    expect(byline('Mig 21', [])).toBe('Mig 21');
    expect(byline(null, [])).toBeNull();
  });

  it('shows a tag once however often the song states it', () => {
    expect(byline(null, ['Koledy', 'koledy'])).toBe('Koledy');
  });
});

describe('keyUnder (D131)', () => {
  const song = (id: number, source: string) =>
    ({ id, source, updatedAt: '2026-11-24T10:00:00.000Z' }) as SongRecord;

  it('names the key a playlist plays a song in, spelled the song’s way', () => {
    const inA = song(1, '{title: T}\n{key: A}\nla [A]la [E]la');
    expect(keyUnder(inA, { semitones: -2, from: 9 })).toBe('G');
    // A Czech song (it writes H): a tone up from A is H, not B.
    const czech = song(2, '{title: T}\n{key: A}\nla [A]la [H7]la');
    expect(keyUnder(czech, { semitones: 2, from: 9 })).toBe('H');
  });

  it('follows the song when its text has since moved key', () => {
    // Set as G from A; the text is in C now: still G.
    const nowInC = song(3, '{title: T}\n{key: C}\nla [C]la');
    expect(keyUnder(nowInC, { semitones: -2, from: 9 })).toBe('G');
  });

  it('names nothing for a song that names no key, or no shift', () => {
    expect(
      keyUnder(song(4, '{title: T}\nla [C]la'), { semitones: 2, from: 0 }),
    ).toBeNull();
    expect(keyUnder(song(5, '{title: T}\n{key: C}\nla [C]la'), undefined)).toBeNull();
  });
});
