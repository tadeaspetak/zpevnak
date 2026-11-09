import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('zpevnak.locale', 'en'));
});

async function searchFor(page: Page, query: string) {
  await page.getByRole('searchbox', { name: 'Search songs' }).fill(query);
}

test('a player finds a song, plays it, and gets back to the results', async ({
  page,
}) => {
  await page.goto('/');
  // Diacritics don't matter: "andelska" finds "Andělská".
  await searchFor(page, 'andelska');
  await page.getByRole('link', { name: /Andělská/ }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Andělská' })).toBeVisible();
  await expect(page.getByText('Aadd9').first()).toBeVisible();

  await page.getByRole('link', { name: 'Back to search results' }).click();
  await expect(page).toHaveURL(/\?q=andelska/);
  await expect(page.getByRole('link', { name: /Andělská/ })).toBeVisible();
});

// The e2e seed's playlist "Vršek 2026" holds the seed songs in order: Andělská, Lajla tov,
// Zkušební písnička (src/server/db/seed.ts).
test('a player goes through a playlist, takes a detour, and comes back', async ({
  page,
}) => {
  const heading = page.getByRole('heading', { level: 1 });
  await page.goto('/playlists');
  await page.getByRole('link', { name: /Vršek 2026/ }).click();
  await page.getByRole('link', { name: 'Play', exact: true }).click();
  await expect(heading).toHaveText('Andělská');

  await page.getByRole('button', { name: 'Next song' }).click();
  await expect(page).toHaveURL(/\/p\/\d+\/2$/);
  await expect(heading).toHaveText('Lajla tov (Dobrou noc)');

  // A request from the crowd: search over the song, play another, then return.
  await page.getByRole('button', { name: 'Search songs' }).click();
  await searchFor(page, 'zkusebni');
  await page.getByRole('link', { name: /Zkušební písnička/ }).click();
  await expect(heading).toHaveText('Zkušební písnička');

  // The song's arrow goes up to the overview (D60); the way back into the playlist is the pill.
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'Back home' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to Vršek 2026' }).click();
  await expect(page).toHaveURL(/\/p\/\d+\/2$/);
  await expect(heading).toHaveText('Lajla tov (Dobrou noc)');
});

test('songs stay searchable and playable offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Lajla tov/ }).first()).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText('Offline')).toBeVisible();
  await searchFor(page, 'lajla');
  await page
    .getByRole('link', { name: /Lajla tov/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: /Lajla tov/ })).toBeVisible();

  // And the search overlay, from the song.
  await page.getByRole('button', { name: 'Search songs' }).click();
  await searchFor(page, 'andelska');
  await page.getByRole('link', { name: /Andělská/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Andělská' })).toBeVisible();
});
