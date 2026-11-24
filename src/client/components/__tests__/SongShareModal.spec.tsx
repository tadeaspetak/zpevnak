import { act, screen } from '@testing-library/react';
import { renderApp } from '#tests/client/render.tsx';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { putPlaylist, putSong } from '../../data/catalog.ts';
import type { PlaylistRecord, SongRecord } from '../../data/store.ts';
import { SongShareModal } from '../SongShareModal.tsx';

const song = {
  id: 7,
  title: 'Naše',
  artist: null,
  status: 'private',
  role: 'owner',
  source: '{title: Naše}\nla la [D]la',
  updatedAt: '2026-11-24T10:00:00.000Z',
} as SongRecord;

const playlist = (id: number, name: string, songIds: number[], listmateCount: number) =>
  ({
    id,
    name,
    songIds,
    listmateCount,
    role: 'owner',
    isPublic: false,
    updatedAt: '2026-11-24T10:00:00.000Z',
  }) as PlaylistRecord;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SongShareModal: the playlists a private song is in (D128)', () => {
  it('lists them with who is in each, and says what that means', async () => {
    localStorage.setItem('zpevnak.locale', 'cs');
    // The people and links are the server's: never answered here.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderApp(<SongShareModal song={song} opened onClose={() => {}} />);
    // In none yet: the device's catalog has loaded, empty.
    expect(await screen.findByText('Zatím v žádném tvém playlistu.')).toBeTruthy();
    expect(
      screen.getByText(/může ji číst, ne měnit. I ten, kdo se přidá později/),
    ).toBeTruthy();
    act(() => {
      // On the device, as it always is for its owner: a playlist lists only songs it has.
      putSong(song);
      putSong({ ...song, id: 3, title: 'Jiná', status: 'verified' });
      putPlaylist(1, playlist(1, 'Vršek', [3, 7], 2));
      putPlaylist(2, playlist(2, 'Zkouška', [7], 0));
      putPlaylist(3, playlist(3, 'Jiný', [3], 4));
    });
    expect(await screen.findByRole('link', { name: 'Vršek' })).toBeTruthy();
    expect(screen.getByText(/^· 2.parťáci$/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zkouška' })).toBeTruthy();
    expect(screen.getByText(/^· jen ty$/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Jiný' })).toBeNull();
  });
});
