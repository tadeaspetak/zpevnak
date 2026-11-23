import { renderHook, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '#shared/urls.ts';
import { renderApp } from '#tests/client/render.tsx';
import { SongPage } from '../pages/SongPage.tsx';

/** The browser offline, as it is at a gig with no signal. */
const offline = () => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('offline', () => {
  it('starts the queries offline when the app opens offline, so edits wait, not fail', async () => {
    // React Query took itself for online until an `offline` event: in an app opened with no
    // signal, a playlist edit failed and was lost.
    offline();
    vi.resetModules();
    await import('../Providers.tsx');
    const { onlineManager } = await import('@tanstack/react-query');
    expect(onlineManager.isOnline()).toBe(false);
  });

  it('says a request needs a connection, rather than that something went wrong', async () => {
    localStorage.setItem('zpevnak.locale', 'cs');
    const { Providers } = await import('../Providers.tsx');
    const { useI18n } = await import('../i18n/index.tsx');
    const { result } = renderHook(() => useI18n(), { wrapper: Providers });
    const failed = new Error('Failed to fetch');
    expect(result.current.tError(failed)).toBe('Něco se pokazilo. Zkus to znovu.');
    offline();
    expect(result.current.tError(failed)).toBe(
      'Jsi offline. Tohle půjde, až bude připojení.',
    );
  });

  it('says a song isn’t on the device, instead of waiting for a sync that can’t come', async () => {
    localStorage.setItem('zpevnak.locale', 'cs');
    offline();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderApp(
      <Routes>
        <Route path={routes.song} element={<SongPage />} />
      </Routes>,
      { path: '/song/9999' },
    );
    expect(await screen.findByText(/Tahle písnička v zařízení není/)).toBeTruthy();
  });
});
