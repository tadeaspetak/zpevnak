import { describe, expect, it } from 'vitest';
import { idFromRef, url } from '../urls.ts';

describe('url', () => {
  it('spells songs and playlists out, id first, slug for people', () => {
    expect(
      url.song({
        id: 2,
        title: 'Lajla tov (Dobrou noc)',
        artist: 'Zuzana Navarová & KOA',
      }),
    ).toBe('/song/2-lajla-tov-dobrou-noc-zuzana-navarova-koa');
    expect(url.song({ id: 5, title: 'Kočky', artist: null })).toBe('/song/5-kocky');
    expect(url.playlist({ id: 1, name: 'Vršek 2026' })).toBe('/playlist/1-vrsek-2026');
    expect(url.playlistSong({ id: 1, name: 'Vršek 2026' }, 3)).toBe(
      '/playlist/1-vrsek-2026/3',
    );
  });

  it('falls back to the bare id when the name has nothing to slug', () => {
    expect(url.playlist({ id: 7, name: '♫♫' })).toBe('/playlist/7');
  });
});

describe('idFromRef', () => {
  it('reads the id, with or without a slug, stale or not', () => {
    expect(idFromRef('12-andelska')).toBe(12);
    expect(idFromRef('12')).toBe(12);
    expect(idFromRef('12-a-name-from-before-a-rename')).toBe(12);
  });

  it('refuses what is not an id', () => {
    expect(idFromRef('andelska')).toBeNull();
    expect(idFromRef('0')).toBeNull();
    expect(idFromRef(undefined)).toBeNull();
  });
});
