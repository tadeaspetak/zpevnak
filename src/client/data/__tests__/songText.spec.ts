import { describe, expect, it } from 'vitest';
import { byline } from '../songText.ts';

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
