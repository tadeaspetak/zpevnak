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
  await owner.getByText(`For playlist ${name}`).click();
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
