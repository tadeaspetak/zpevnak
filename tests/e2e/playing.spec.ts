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

test('a player goes through a playlist, takes a detour, and comes back', async ({
  page,
}) => {
  await page.goto('/playlists');
  await page.getByRole('link', { name: /Vršek 2026/ }).click();
  await page.getByRole('link', { name: 'Play', exact: true }).click();
  await expect(page).toHaveURL(/\/p\/\d+\/1$/);

  await page.getByRole('button', { name: 'Next song' }).click();
  await expect(page).toHaveURL(/\/p\/\d+\/2$/);
  const second = await page.getByRole('heading', { level: 1 }).textContent();

  // A request from the crowd: search for something else, play it, then return.
  await page.getByRole('link', { name: 'Search songs' }).click();
  await searchFor(page, 'zkusebni');
  await page.getByRole('link', { name: /Zkušební písnička/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Zkušební písnička' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Back to Vršek 2026' }).click();
  await expect(page).toHaveURL(/\/p\/\d+\/2$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(second ?? '');
});

test('songs stay searchable and playable offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Lajla tov/ })).toBeVisible();

  await context.setOffline(true);
  await searchFor(page, 'lajla');
  await page.getByRole('link', { name: /Lajla tov/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Lajla tov/ })).toBeVisible();
  await expect(page.getByText('Offline')).toHaveCount(0); // the badge lives on the overview
  await page.getByRole('link', { name: 'Search songs' }).click();
  await expect(page.getByText('Offline')).toBeVisible();
});
