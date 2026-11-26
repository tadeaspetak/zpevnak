import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '#tests/client/render.tsx';
import { InstallButton, InstallHint } from '../InstallApp.tsx';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1';
const FIREFOX = 'Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131.0 Mobile Safari/537.36';

/** A device: its pointer, whether the app is open from the home screen, its browser. */
function device({
  touch = true,
  standalone = false,
  userAgent = ANDROID,
}: {
  touch?: boolean;
  standalone?: boolean;
  userAgent?: string;
}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches:
      (query === '(pointer: coarse)' && touch) ||
      (query === '(display-mode: standalone)' && standalone),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
}

/** Chrome offering to install the app, as it does once the page qualifies. */
function offerInstall() {
  const prompt = vi.fn(() => Promise.resolve());
  act(() => {
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt }));
  });
  return prompt;
}

describe('adding the app to the home screen (D141)', () => {
  beforeEach(() => localStorage.setItem('zpevnak.locale', 'cs'));
  afterEach(() => {
    // The offer is the page's, kept between renders: gone, as after installing.
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens Chrome’s own dialog on an Android phone, once, then offers no more', async () => {
    device({});
    renderApp(<InstallHint />);
    expect(screen.queryByText('Zpěvňák jako aplikace')).toBeNull();
    const prompt = offerInstall();
    fireEvent.click(screen.getByRole('button', { name: 'Přidat na plochu' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Přidat na plochu' })).toBeNull();
  });

  it('shows the steps through Share on an iPhone, where a page can’t install', async () => {
    device({ userAgent: IPHONE });
    renderApp(<InstallButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Přidat na plochu' }));
    expect(await screen.findByText(/Ťukni na Sdílet/)).toBeTruthy();
    expect(screen.getByText(/Vyber „Přidat na plochu“/)).toBeTruthy();
  });

  it('shows the steps through its menu in Firefox on Android (D142)', async () => {
    device({ userAgent: FIREFOX });
    renderApp(<InstallButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Přidat na plochu' }));
    expect(await screen.findByText(/Otevři nabídku ⋮/)).toBeTruthy();
    expect(screen.getByText(/Vyber „Nainstalovat“ nebo „Přidat na plochu“/)).toBeTruthy();
    expect(screen.queryByText(/Sdílet/)).toBeNull();
  });

  it('offers nothing when the app is already open from the home screen', () => {
    device({ standalone: true, userAgent: IPHONE });
    renderApp(<InstallButton />);
    offerInstall();
    expect(screen.queryByRole('button', { name: 'Přidat na plochu' })).toBeNull();
  });

  it('offers nothing on a laptop, though Chrome there would install it', () => {
    device({ touch: false });
    renderApp(<InstallButton />);
    offerInstall();
    expect(screen.queryByRole('button', { name: 'Přidat na plochu' })).toBeNull();
  });

  it('hides the overview’s card for good once closed, the button staying in settings', () => {
    device({ userAgent: IPHONE });
    const first = renderApp(<InstallHint />);
    fireEvent.click(screen.getByRole('button', { name: 'Skrýt' }));
    expect(screen.queryByText('Zpěvňák jako aplikace')).toBeNull();
    first.unmount();
    renderApp(
      <>
        <InstallHint />
        <InstallButton />
      </>,
    );
    expect(screen.queryByText('Zpěvňák jako aplikace')).toBeNull();
    expect(screen.getByRole('button', { name: 'Přidat na plochu' })).toBeTruthy();
  });
});
