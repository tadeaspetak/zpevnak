import { expect, type Browser, type Page } from '@playwright/test';

const BASE = 'http://localhost:3101';

/** A page signed in as a dev persona (seeded for e2e), in English. */
export async function signedIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE });
  await context.addInitScript(() => localStorage.setItem('zpevnak.locale', 'en'));
  const page = await context.newPage();
  const response = await page.request.post('/trpc/auth.logIn', {
    data: { email, password: 'zpevnak-dev-password' },
  });
  expect(response.ok()).toBe(true);
  return page;
}

/** A playlist made by `owner` through the API, and its invite token. */
export async function playlistWithInvite(owner: Page, name: string, isPublic = false) {
  const created = await owner.request.post('/trpc/playlists.create', {
    data: { name, isPublic, songIds: [] },
  });
  const playlist = (await created.json()).result.data as { id: number; name: string };
  const invite = await owner.request.post('/trpc/playlists.invite', {
    data: { id: playlist.id },
  });
  const { token } = (await invite.json()).result.data as { token: string };
  return { playlist, token };
}
