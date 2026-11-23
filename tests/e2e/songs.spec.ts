import { expect, test } from '@playwright/test';
import { idFromRef, url } from '#shared/urls.ts';
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
  await player.getByRole('link', { name: tag, exact: true }).click();
  await expect(player.getByRole('heading', { level: 1, name: tag })).toBeVisible();
  await player.getByRole('link', { name: new RegExp(title) }).click();
  await expect(player.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await player.getByRole('link', { name: `Back to ${tag}` }).click();
  await expect(player).toHaveURL(/\/tag\/koledy-\d+$/);
});

test('an editor transposes a song and saves it in that key, for everyone (D119)', async ({
  browser,
}) => {
  const title = `Hvězdy ${Date.now()}`;
  const editor = await signedIn(browser, 'editor@zpevnak.test');
  await editor.goto('/new');
  await editor
    .getByRole('textbox', { name: 'ChordPro' })
    .fill(`{title: ${title}}\n{key: A}\n\n[A]la la [D]la [E]lo`);
  await editor.getByRole('button', { name: 'Submit for review' }).click();
  await expect(editor.getByRole('heading', { level: 1, name: title })).toBeVisible();
  const songId = idFromRef(new URL(editor.url()).pathname.split('/')[2]);

  for (let i = 0; i < 3; i++) {
    await editor.getByRole('button', { name: 'Up a semitone' }).click();
  }
  await expect(editor.getByRole('button', { name: 'C: Back to A' })).toBeVisible();
  await editor.getByRole('button', { name: 'More options' }).click();
  await editor.getByRole('menuitem', { name: 'Save in C' }).click();
  await editor.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(editor.getByText('Saved in C.')).toBeVisible();
  // The song's own key now: nothing transposed, nothing to go back to.
  await expect(editor.getByRole('button', { name: /Back to/ })).toHaveCount(0);

  await editor.goto(url.editSong(Number(songId)));
  await expect(editor.getByRole('textbox', { name: 'ChordPro' })).toHaveValue(
    `{title: ${title}}\n{key: C}\n\n[C]la la [F]la [G]lo`,
  );
});

test('an editor reviews a song from the song itself and comes back to it (D121, D123)', async ({
  browser,
}) => {
  const title = `Sněženky ${Date.now()}`;
  const author = await signedIn(browser, 'user@zpevnak.test');
  await author.goto('/new');
  await author
    .getByRole('textbox', { name: 'ChordPro' })
    .fill(`{title: ${title}}\n\nla la [D]la`);
  await author.getByRole('button', { name: 'Submit for review' }).click();
  await expect(author.getByRole('heading', { level: 1, name: title })).toBeVisible();
  const songUrl = author.url();

  const editor = await signedIn(browser, 'editor@zpevnak.test');
  await editor.goto(songUrl);
  await editor.getByRole('link', { name: 'Review' }).click();
  await expect(editor.getByRole('link', { name: `Back to ${title}` })).toBeVisible();
  await editor.getByRole('button', { name: 'Approve' }).click();
  await expect(editor).toHaveURL(songUrl);
  await expect(editor.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(editor.getByText('Nobody has approved this song yet.')).toHaveCount(0);
});

test('an author keeps a song private, and shares it by the reading link (D127)', async ({
  browser,
}) => {
  const title = `Naše ${Date.now()}`;
  const author = await signedIn(browser, 'user@zpevnak.test');
  await author.goto('/new');
  await author
    .getByRole('textbox', { name: 'ChordPro' })
    .fill(`{title: ${title}}\n\nla la [D]la`);
  await author.getByRole('switch', { name: 'Private, just for me' }).check();
  // Private, nothing goes for review: the button only saves.
  await author.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(author.getByRole('heading', { level: 1, name: title })).toBeVisible();
  const songPath = new URL(author.url()).pathname;

  // Not for the songbook's editors: for them it isn't there.
  const editor = await signedIn(browser, 'editor@zpevnak.test');
  await editor.goto(songPath);
  await expect(editor.getByText(/This song isn.t here/)).toBeVisible();

  await author.getByRole('button', { name: 'More options' }).click();
  await author.getByRole('menuitem', { name: 'Sharing' }).click();
  await expect(
    author.getByRole('radio', { name: /^Private\s*Only you and your listmates/ }),
  ).toBeChecked();
  const readLink = author.getByRole('textbox', { name: 'Link to read' });
  await expect(readLink).toHaveValue(/\/join\/\S+$/);
  const joinPath = new URL(await readLink.inputValue()).pathname;

  // Through the link, the same person reads it.
  await editor.goto(joinPath);
  await expect(
    editor.getByText('You will be able to read it, not change it.'),
  ).toBeVisible();
  await expect(editor.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await editor.getByRole('button', { name: 'More options' }).click();
  await expect(editor.getByRole('menuitem', { name: 'Edit' })).toHaveCount(0);
});
