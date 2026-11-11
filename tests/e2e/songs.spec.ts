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
