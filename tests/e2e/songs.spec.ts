import { expect, test, type Browser, type Page } from '@playwright/test';

const BASE = 'http://localhost:3101';

/** A page signed in as a dev persona (seeded for e2e), in English. */
async function signedIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE });
  await context.addInitScript(() => localStorage.setItem('zpevnak.locale', 'en'));
  const page = await context.newPage();
  const response = await page.request.post('/trpc/auth.logIn', {
    data: { email, password: 'zpevnak-dev-password' },
  });
  expect(response.ok()).toBe(true);
  return page;
}

test('a contributor pastes chords above lyrics, converts them, and an editor approves the song', async ({
  browser,
}) => {
  const title = `Lesní ${Date.now()}`;
  const author = await signedIn(browser, 'user@zpevnak.test');
  // Opened directly, cold: a signed-in contributor stays (it used to be sent to log in).
  await author.goto('/new');
  const source = author.getByRole('textbox', { name: 'ChordPro' });
  await source.fill([title, 'Kapela Mech', '', 'C     G', 'la la la lo'].join('\n'));
  await author.getByRole('button', { name: 'Convert' }).click();
  await expect(source).toHaveValue(
    `{title: ${title}}\n{artist: Kapela Mech}\n\n[C]la la [G]la lo\n`,
  );
  await author.getByRole('button', { name: 'Submit for review' }).click();
  await expect(author.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(author).toHaveURL(/\/song\/\d+/);

  const editor = await signedIn(browser, 'editor@zpevnak.test');
  await editor.goto('/queue');
  await editor.getByRole('link', { name: new RegExp(title) }).click();
  await editor.getByRole('button', { name: 'Approve' }).click();
  await expect(editor.getByText(`Approved: ${title}`)).toBeVisible();
});

test('an owner takes a listmate out by mistake, and takes it back', async ({
  browser,
}) => {
  const owner = await signedIn(browser, 'user@zpevnak.test');
  const created = await owner.request.post('/trpc/playlists.create', {
    data: { name: `Advent ${Date.now()}`, isPublic: false, songIds: [] },
  });
  const playlist = (await created.json()).result.data as { id: number };
  const invite = await owner.request.get(
    `/trpc/playlists.invite?input=${encodeURIComponent(JSON.stringify({ id: playlist.id }))}`,
  );
  const { token } = (await invite.json()).result.data as { token: string };
  const listmate = await signedIn(browser, 'editor@zpevnak.test');
  await listmate.request.post('/trpc/playlists.join', { data: { token } });

  await owner.goto(`/playlist/${playlist.id}`);
  await owner.getByRole('button', { name: 'Listmates' }).click();
  await owner.getByRole('button', { name: 'Remove Erik Editor' }).click();
  // The toast names the person, in the reader's language (it once crashed outside them).
  await expect(
    owner.getByText('Erik Editor is no longer in the playlist.'),
  ).toBeVisible();
  await owner.getByRole('button', { name: 'Undo' }).click();
  await expect(owner.getByRole('button', { name: 'Remove Erik Editor' })).toBeVisible();
});
