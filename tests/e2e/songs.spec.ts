import { expect, test } from '@playwright/test';
import { signedIn } from './helpers.ts';

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

test('an editor tags a song, and a player finds it among the tag’s songs (D118)', async ({
  browser,
}) => {
  const stamp = Date.now();
  const title = `Zvonky ${stamp}`;
  const tag = `Koledy ${stamp}`;
  const editor = await signedIn(browser, 'editor@zpevnak.test');
  await editor.goto('/new');
  await editor
    .getByRole('textbox', { name: 'ChordPro' })
    .fill(`{title: ${title}}\n\nla la [D]la`);
  const tags = editor.getByRole('combobox', { name: 'Tags' });
  await tags.fill(tag);
  await tags.press('Enter');
  await expect(editor.getByRole('textbox', { name: 'ChordPro' })).toHaveValue(
    `{title: ${title}}\n{tag: ${tag}}\n\nla la [D]la`,
  );
  await editor.getByRole('button', { name: 'Submit for review' }).click();
  await expect(editor.getByRole('heading', { level: 1, name: title })).toBeVisible();

  const player = await signedIn(browser, 'user@zpevnak.test');
  await player.goto('/');
  await player.getByRole('link', { name: tag }).click();
  await expect(player.getByRole('heading', { level: 1, name: tag })).toBeVisible();
  await player.getByRole('link', { name: new RegExp(title) }).click();
  await expect(player.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await player.getByRole('link', { name: `Back to ${tag}` }).click();
  await expect(player).toHaveURL(/\/tag\/koledy-\d+$/);
});
