import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '#tests/client/render.tsx';
import { PlaylistsPage } from '../PlaylistsPage.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlaylistsPage', () => {
  it('shows a loader, not "no playlists", before the catalog has arrived', async () => {
    localStorage.setItem('zpevnak.locale', 'cs');
    // The server never answers: the catalog is still on its way.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderApp(<PlaylistsPage />, { path: '/playlists' });
    expect(await screen.findByRole('status', { name: 'Načítám…' })).toBeTruthy();
    expect(screen.queryByText('Zatím žádné playlisty.')).toBeNull();
  });
});
