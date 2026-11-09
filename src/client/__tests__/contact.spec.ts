import { describe, expect, it } from 'vitest';
import { mailtoAuthor } from '../contact.ts';

describe('mailtoAuthor', () => {
  it('writes to the author with the subject and body encoded the way mail apps read them', () => {
    const link = mailtoAuthor(
      'Chyba v písničce: Kočky – Nerez',
      'Písnička: https://zpevnak.tadeaspetak.com/song/1-kocky\n\nCo je špatně:\n',
    );
    expect(link.startsWith('mailto:tadeaspetak@gmail.com?')).toBe(true);
    expect(link).not.toContain('+');
    const params = new URLSearchParams(link.split('?')[1]);
    expect(params.get('subject')).toBe('Chyba v písničce: Kočky – Nerez');
    expect(params.get('body')).toBe(
      'Písnička: https://zpevnak.tadeaspetak.com/song/1-kocky\n\nCo je špatně:\n',
    );
  });
});
