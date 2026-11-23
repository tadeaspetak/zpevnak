import { expect, test } from '@playwright/test';
import { url } from '#shared/urls.ts';
import { playlistWithInvite, signedIn } from './helpers.ts';

test('an owner takes a listmate out by mistake, takes it back, and replaces the link', async ({
  browser,
}) => {
  const owner = await signedIn(browser, 'user@zpevnak.test');
  const { playlist, token } = await playlistWithInvite(owner, `Advent ${Date.now()}`);
  const listmate = await signedIn(browser, 'editor@zpevnak.test');
  await listmate.request.post('/trpc/sharing.join', { data: { token } });

  await owner.goto(`/playlist/${playlist.id}`);
  await owner.getByRole('button', { name: 'Sharing' }).click();
  // The invite link, asked for as the dialog opens: the same one the bandmate joined by.
  const link = owner.getByRole('textbox', { name: 'Link to edit' });
  await expect(link).toHaveValue(new RegExp(`/join/${token}$`));
  await owner.getByRole('button', { name: 'Remove Erik Editor' }).click();
  // The toast names the person, in the reader's language (it once crashed outside them).
  await expect(
    owner.getByText('Erik Editor is no longer in the playlist.'),
  ).toBeVisible();
  await owner.getByRole('button', { name: 'Undo' }).click();
  await expect(owner.getByRole('button', { name: 'Remove Erik Editor' })).toBeVisible();

  // A new link asks first (the old one stops working for everyone), then says so.
  await owner.getByRole('button', { name: 'Replace: Link to edit' }).click();
  await owner.getByRole('button', { name: 'Cancel' }).click();
  await expect(link).toHaveValue(new RegExp(`/join/${token}$`));
  await owner.getByRole('button', { name: 'Replace: Link to edit' }).click();
  await owner.getByRole('button', { name: 'Make a new one' }).click();
  await expect(
    owner.getByText('Done, the old link no longer works.', { exact: false }),
  ).toBeVisible();
  // The new link replaces the old one in its field.
  await expect(link).not.toHaveValue(new RegExp(`/join/${token}$`));
  await expect(link).toHaveValue(/\/join\/\S+$/);

  // Taken out, then the dialog closed: the way back moves to a toast.
  await owner.getByRole('button', { name: 'Remove Erik Editor' }).click();
  await owner.keyboard.press('Escape');
  await owner.getByRole('alert').getByRole('button', { name: 'Undo' }).click();
  await owner.getByRole('button', { name: 'Sharing' }).click();
  await expect(owner.getByRole('button', { name: 'Remove Erik Editor' })).toBeVisible();
});

test('a reader joins by the reading link, only reads, and can edit once the owner lets them', async ({
  browser,
}) => {
  const owner = await signedIn(browser, 'user@zpevnak.test');
  const { playlist } = await playlistWithInvite(owner, `Zpěváci ${Date.now()}`);
  await owner.goto(`/playlist/${playlist.id}`);
  await owner.getByRole('button', { name: 'Sharing' }).click();
  const readLink = owner.getByRole('textbox', { name: 'Link to read' });
  await expect(readLink).toHaveValue(/\/join\/\S+$/);
  const joinPath = new URL(await readLink.inputValue()).pathname;

  // The singer opens the link: it says what they'll be able to do, and takes them in.
  const reader = await signedIn(browser, 'editor@zpevnak.test');
  await reader.goto(joinPath);
  await expect(
    reader.getByRole('heading', { level: 1, name: playlist.name }),
  ).toBeVisible();
  await expect(reader.getByRole('button', { name: 'Sharing' })).toBeVisible();
  await expect(reader.getByRole('button', { name: 'Edit playlist' })).toHaveCount(0);
  await expect(reader.getByRole('button', { name: 'Add songs' })).toHaveCount(0);

  // The owner sees them as a reader, and lets them edit.
  await owner.keyboard.press('Escape');
  await owner.getByRole('button', { name: 'Sharing' }).click();
  const role = owner.getByRole('combobox', { name: 'What Erik Editor can do' });
  await expect(role).toHaveValue('viewer');
  await role.selectOption({ label: 'Can edit' });
  await expect(role).toHaveValue('collaborator');

  await reader.getByRole('button', { name: 'Settings' }).click();
  await reader.getByRole('button', { name: 'Get what’s new' }).click();
  await reader.keyboard.press('Escape');
  await expect(reader.getByRole('button', { name: 'Edit playlist' })).toBeVisible();
});

test('a listmate taken out while editing leaves the editor', async ({ browser }) => {
  const owner = await signedIn(browser, 'user@zpevnak.test');
  // Public: after being taken out, they can still see it, just not edit it.
  const { playlist, token } = await playlistWithInvite(owner, `Trh ${Date.now()}`, true);
  const listmate = await signedIn(browser, 'editor@zpevnak.test');
  await listmate.request.post('/trpc/sharing.join', { data: { token } });
  await listmate.goto(`/playlist/${playlist.id}`);
  await listmate.getByRole('button', { name: 'Edit playlist' }).click();
  await expect(listmate.getByLabel('Name')).toBeVisible();

  const me = await (await listmate.request.get('/trpc/auth.me')).json();
  await owner.request.post('/trpc/sharing.removeMember', {
    data: { kind: 'playlist', id: playlist.id, userId: me.result.data.id },
  });
  // From the settings, which also fetch the playlist on the page, not only the one being played.
  await listmate.getByRole('button', { name: 'Settings' }).click();
  await listmate.getByRole('button', { name: 'Get what’s new' }).click();
  await expect(listmate.getByLabel('Name')).toBeHidden();
  await expect(listmate.getByRole('button', { name: 'Done' })).toBeHidden();
});

test('a listmate without a confirmed email sees who is in, and can leave', async ({
  browser,
}) => {
  const owner = await signedIn(browser, 'user@zpevnak.test');
  const { playlist, token } = await playlistWithInvite(owner, `Jarmark ${Date.now()}`);
  const fresh = await signedIn(browser, 'new@zpevnak.test');
  await fresh.request.post('/trpc/sharing.join', { data: { token } });
  await fresh.goto(`/playlist/${playlist.id}`);
  // Why they can't edit yet, and the way to fix it right there.
  await expect(fresh.getByRole('button', { name: 'Send the email again' })).toBeVisible();
  await fresh.getByRole('button', { name: 'Sharing' }).click();
  const dialog = fresh.getByRole('dialog');
  // Everyone in it sees who is; only the owner is marked.
  await expect(dialog.getByText('Uršula Uživatelová')).toBeVisible();
  await expect(dialog.getByText('Owner', { exact: true })).toBeVisible();
  // A listmate sees who sees it, and can't change it: a tap asks nothing of the server.
  const asked: string[] = [];
  fresh.on(
    'request',
    (r) => r.url().includes('playlists.setPublic') && asked.push(r.url()),
  );
  await dialog.getByText('Public', { exact: true }).click();
  await expect(dialog.getByRole('radio', { name: /^Private/ })).toBeChecked();
  await fresh.waitForTimeout(300);
  expect(asked).toEqual([]);
  await fresh.getByRole('button', { name: 'Leave playlist' }).click();
  await fresh.getByRole('button', { name: 'Leave playlist' }).last().click();
  await expect(fresh).toHaveURL(/\/playlists$/);
});

test('an owner renames a playlist with Enter, and an emptied name comes back', async ({
  browser,
}) => {
  const owner = await signedIn(browser, 'user@zpevnak.test');
  const { playlist } = await playlistWithInvite(owner, `Koledy ${Date.now()}`);
  await owner.goto(`/playlist/${playlist.id}`);
  await owner.getByRole('button', { name: 'Edit playlist' }).click();
  const name = owner.getByLabel('Name');
  await name.fill('Koledy na náměstí');
  await name.press('Enter');
  await expect(owner.getByRole('heading', { level: 1 })).toHaveText('Koledy na náměstí');
  await name.fill('   ');
  await name.press('Enter');
  await expect(name).toHaveValue('Koledy na náměstí');
});

test('an owner takes a song out by mistake and puts it back in its place', async ({
  browser,
}) => {
  const owner = await signedIn(browser, 'user@zpevnak.test');
  const sync = await (
    await owner.request.get(
      `/trpc/songs.sync?input=${encodeURIComponent('{"since":null}')}`,
    )
  ).json();
  const ids = (sync.result.data.songs as { id: number; status: string }[])
    .filter((s) => s.status === 'verified')
    .slice(0, 3)
    .map((s) => s.id);
  const created = await owner.request.post('/trpc/playlists.create', {
    data: { name: `Pořadí ${Date.now()}`, isPublic: false, songIds: ids },
  });
  const playlist = (await created.json()).result.data as { id: number };
  await owner.goto(`/playlist/${playlist.id}`);

  await owner.getByRole('button', { name: 'Edit playlist' }).click();
  await owner
    .getByRole('button', { name: /^Remove / })
    .nth(1)
    .click();
  await expect(owner.getByText(/is out of the playlist\.$/)).toBeVisible();
  await owner.getByRole('button', { name: 'Undo' }).click();
  await owner.getByRole('button', { name: 'Done' }).click();
  // Back where it was, for everyone: the server has the same order as before.
  await expect
    .poll(async () => {
      const response = await owner.request.get(
        `/trpc/playlists.byId?input=${encodeURIComponent(JSON.stringify({ id: playlist.id }))}`,
      );
      return (await response.json()).result.data.songIds;
    })
    .toEqual(ids);
});

test('an owner shares a public playlist to look at, and the invite offers just looking', async ({
  browser,
}) => {
  const owner = await signedIn(browser, 'user@zpevnak.test');
  const { playlist, token } = await playlistWithInvite(owner, `Náves ${Date.now()}`);
  await owner.goto(`/playlist/${playlist.id}`);
  await owner.getByRole('button', { name: 'Sharing' }).click();
  // What each choice means sits inside it.
  await expect(
    owner.getByRole('radio', { name: /^Private\s*Only listmates see it/ }),
  ).toBeChecked();
  // The link is there while private too: it still takes listmates straight in.
  const viewLink = owner.getByRole('textbox', { name: 'Link to the playlist' });
  await expect(viewLink).toHaveValue(new RegExp(`/playlist/${playlist.id}-`));
  await owner.getByText('Public', { exact: true }).click();
  // Once the server has it, the same link is for anyone.
  await expect(owner.getByRole('radio', { name: /^Public/ })).toBeChecked();
  await expect(viewLink).toHaveValue(new RegExp(`/playlist/${playlist.id}-`));

  // Someone signed out with the invite: they can join, or only look.
  const stranger = await browser.newPage();
  await stranger.addInitScript(() => localStorage.setItem('zpevnak.locale', 'en'));
  await stranger.goto(`http://localhost:3101/join/${token}`);
  await stranger.getByRole('link', { name: 'Just look' }).click();
  await expect(
    stranger.getByRole('heading', { level: 1, name: playlist.name }),
  ).toBeVisible();
});

test('a player ticks a song into a playlist and unticks it out again (D124)', async ({
  browser,
}) => {
  const player = await signedIn(browser, 'user@zpevnak.test');
  const { playlist } = await playlistWithInvite(player, `Koledy ${Date.now()}`);
  const title = `Rolničky ${Date.now()}`;
  const created = await player.request.post('/trpc/songs.create', {
    data: { source: `{title: ${title}}\n\nla la [D]la` },
  });
  const song = (await created.json()).result.data as { id: number };

  await player.goto(url.song({ id: song.id, title, artist: null }));
  await player.getByRole('button', { name: 'More options' }).click();
  await player.getByRole('menuitem', { name: 'Add to playlist' }).click();
  const option = player.getByRole('checkbox', { name: playlist.name });
  await expect(option).not.toBeChecked();
  await option.click();
  await expect(option).toBeChecked();
  // Still open: a tap switches, it doesn't close the dialog.
  await option.click();
  await expect(option).not.toBeChecked();
  await player.keyboard.press('Escape');

  await player.goto(url.playlist(playlist));
  await expect(player.getByText(title)).toHaveCount(0);
});
