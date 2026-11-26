import { act, renderHook, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '#tests/client/render.tsx';
import { putPlaylist, putSong, useCatalog } from '../../data/catalog.ts';
import { playPlaylist } from '../../data/session.ts';
import type { PlaylistRecord, SongRecord } from '../../data/store.ts';
import { routes } from '#shared/urls.ts';
import { PlaylistPage } from '../PlaylistPage.tsx';

const songs = Array.from(
  { length: 30 },
  (_, i) =>
    ({
      id: i + 1,
      title: `Píseň ${i + 1}`,
      artist: null,
      status: 'verified',
      source: `{title: Píseň ${i + 1}}`,
      updatedAt: '2026-11-22T10:00:00.000Z',
    }) as SongRecord,
);
const long = {
  id: 7,
  name: 'Třicítka',
  isPublic: false,
  role: 'owner',
  songIds: songs.map((s) => s.id),
  songKeys: {},
  updatedAt: '2026-11-22T10:00:00.000Z',
} as unknown as PlaylistRecord;

describe('PlaylistPage: back from a song deep in a long playlist (D148)', () => {
  beforeEach(() => {
    localStorage.setItem('zpevnak.locale', 'cs');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
  });
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('brings the song one is at into sight, once', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    playPlaylist(long.id, 18);
    renderApp(
      <Routes>
        <Route path={routes.playlist} element={<PlaylistPage />} />
      </Routes>,
      { path: '/playlist/7-tricitka' },
    );
    // The device's copy (none here) is read first; the catalog comes after, as from a sync.
    const catalog = renderHook(() => useCatalog()).result;
    await vi.waitFor(() => expect(catalog.current.loaded).toBe(true));
    act(() => {
      songs.forEach(putSong);
      putPlaylist(long.id, long);
    });
    await screen.findByText('Píseň 18');
    await vi.waitFor(() => expect(scrolled).toHaveBeenCalledTimes(1));
    expect(scrolled.mock.contexts[0]).toBe(
      screen.getByText('Píseň 18').closest('[data-active]'),
    );
  });
});
