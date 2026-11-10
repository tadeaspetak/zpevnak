import { describe, expect, it } from 'vitest';
import { reviewContext } from '../reviewContext.ts';
import type { PlaylistRecord } from '../store.ts';

const t = (key: string, params?: Record<string, string | number>) =>
  `${key}${params ? JSON.stringify(params) : ''}`;
const compare = new Intl.Collator('cs').compare;
const playlist = (name: string, songIds: number[]) =>
  ({ name, songIds }) as PlaylistRecord;

describe('reviewContext', () => {
  it('names the playlists a song is in, and that it is back fixed', () => {
    expect(
      reviewContext(
        7,
        { reason: 'too_many_mistakes', note: null },
        [playlist('Vršek', [7]), playlist('Jiný', [8]), playlist('Advent', [1, 7])],
        { t, compare } as never,
      ),
    ).toEqual([
      'queue.inPlaylists{"names":"Advent, Vršek"}',
      'queue.fixedAfterRejection',
    ]);
  });

  it('says one playlist in the singular, and nothing about a first submission', () => {
    expect(
      reviewContext(7, null, [playlist('Vršek', [7])], { t, compare } as never),
    ).toEqual(['queue.inPlaylist{"name":"Vršek"}']);
    expect(reviewContext(7, null, [], { t, compare } as never)).toEqual([]);
  });
});
