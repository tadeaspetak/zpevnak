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

test('an owner adds and removes songs from the keyboard', async ({ page }) => {
  await page.request.post('/trpc/auth.logIn', {
    data: { email: 'user@zpevnak.test', password: 'zpevnak-dev-password' },
  });
  // A playlist of its own, holding every song, so the shared seed playlist stays as it is.
  const sync = await page.request.get(
    `/trpc/songs.sync?input=${encodeURIComponent(JSON.stringify({ since: null }))}`,
  );
  const songIds = ((await sync.json()).result.data.songs as { id: number }[]).map(
    (s) => s.id,
  );
  const created = await page.request.post('/trpc/playlists.create', {
    data: { name: `Keyboard ${Date.now()}`, isPublic: false, songIds },
  });
  const playlistId: number = (await created.json()).result.data.id;

  await page.goto(`/p/${playlistId}`);
  await expect(page.getByText('3 songs')).toBeVisible();
  await page.getByRole('button', { name: 'Edit playlist' }).click();
  await page.getByRole('button', { name: 'Add songs' }).click();

  const box = page.getByRole('combobox', { name: 'Add songs' });
  await box.fill('andelska');
  // Already in the playlist: Enter takes it out, a second Enter puts it back.
  await expect(page.getByRole('option', { name: /Andělská/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await box.press('Enter');
  await expect(page.getByRole('option', { name: /Andělská/ })).toHaveAttribute(
    'aria-selected',
    'false',
  );
  // The search text is selected: typing replaces it.
  expect(
    await box.evaluate(
      (el: HTMLInputElement) => (el.selectionEnd ?? 0) - (el.selectionStart ?? 0),
    ),
  ).toBe('andelska'.length);
  await box.press('Enter');
  await expect(page.getByRole('option', { name: /Andělská/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  // ↓ moves the highlight, and Enter toggles the highlighted song: the second result here,
  // which (like every seed song) is in the playlist, so it comes out.
  await box.pressSequentially('la');
  const second = page.getByRole('option').nth(1);
  await expect(second).toHaveAttribute('aria-selected', 'true');
  await box.press('ArrowDown');
  await box.press('Enter');
  await expect(second).toHaveAttribute('aria-selected', 'false');
  await page.keyboard.press('Escape');
  await expect(page.getByText('2 songs')).toBeVisible();
});
