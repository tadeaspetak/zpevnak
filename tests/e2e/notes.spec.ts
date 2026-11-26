import { expect, test } from '@playwright/test';
import { signedIn } from './helpers.ts';

test('a band note, written at a line, is read by a visitor without an account (D135)', async ({
  browser,
}) => {
  const owner = await signedIn(browser, 'user@zpevnak.test');
  const sync = await (
    await owner.request.get(
      `/trpc/songs.sync?input=${encodeURIComponent('{"since":null}')}`,
    )
  ).json();
  const song = (sync.result.data.songs as { id: number; status: string }[]).find(
    (s) => s.status === 'verified',
  );
  const name = `Zkouška ${Date.now()}`;
  const created = await owner.request.post('/trpc/playlists.create', {
    data: { name, isPublic: true, songIds: [song?.id] },
  });
  const playlist = (await created.json()).result.data as { id: number };

  await owner.goto(`/playlist/${playlist.id}/1`);
  const line = owner.locator('[data-place="1"]');
  await line.click({ button: 'right' });
  await owner.getByRole('menuitem', { name: 'Add a note' }).click();
  await owner.getByRole('textbox', { name: 'Note' }).fill('Chorus three times, end on G');
  await owner.getByRole('radio', { name: `For playlist “${name}”` }).check();
  await owner.getByRole('button', { name: 'Save' }).click();
  await expect(owner.getByRole('button', { name: /Chorus three times/ })).toBeVisible();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/playlist/${playlist.id}/1`);
  const note = visitor.getByText('Chorus three times, end on G');
  await expect(note).toBeVisible();
  // Under its line, and not theirs to change.
  await expect(visitor.locator('[data-place="1"] + [data-notes]')).toContainText(
    'Chorus three times',
  );
  await expect(visitor.getByRole('button', { name: /Chorus three times/ })).toHaveCount(
    0,
  );
});

test('a reader signs in to report a mistake, lands in the report, and an editor fixes it (D143)', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: 'http://localhost:3101' });
  await context.addInitScript(() => localStorage.setItem('zpevnak.locale', 'en'));
  const reader = await context.newPage();
  const sync = await (
    await reader.request.get(
      `/trpc/songs.sync?input=${encodeURIComponent('{"since":null}')}`,
    )
  ).json();
  const song = (sync.result.data.songs as { id: number; status: string }[]).find(
    (s) => s.status === 'verified',
  );
  await reader.goto(`/song/${song?.id}`);
  await reader.getByRole('button', { name: 'More options' }).click();
  await reader.getByRole('menuitem', { name: 'Report a mistake' }).click();

  // Signed out, reporting goes through signing in, and back to the report.
  await reader.getByLabel('Email').fill('user@zpevnak.test');
  await reader.getByRole('textbox', { name: 'Password' }).fill('zpevnak-dev-password');
  await reader.getByRole('button', { name: 'Log in' }).click();
  const text = `The second chord is Am ${Date.now()}`;
  await reader.getByRole('textbox', { name: 'Note' }).fill(text);
  await reader.getByRole('button', { name: 'Save' }).click();
  await expect(reader.getByRole('button', { name: new RegExp(text) })).toBeVisible();
  await expect(reader).not.toHaveURL(/report=/);

  const editor = await signedIn(browser, 'editor@zpevnak.test');
  await editor.goto(`/song/${song?.id}`);
  await editor.getByRole('button', { name: new RegExp(text) }).click();
  await editor.getByRole('button', { name: 'Fixed' }).click();
  await expect(editor.getByText(text)).toHaveCount(0);
});
