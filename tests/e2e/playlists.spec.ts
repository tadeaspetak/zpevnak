import { expect, test } from '@playwright/test';
import { playlistWithInvite, signedIn } from './helpers.ts';

test('an owner takes a listmate out by mistake, takes it back, and replaces the link', async ({
  browser,
}) => {
  const owner = await signedIn(browser, 'user@zpevnak.test');
  const { playlist, token } = await playlistWithInvite(owner, `Advent ${Date.now()}`);
  const listmate = await signedIn(browser, 'editor@zpevnak.test');
  await listmate.request.post('/trpc/playlists.join', { data: { token } });

  await owner.goto(`/playlist/${playlist.id}`);
  await owner.getByRole('button', { name: 'Sharing' }).click();
  // The invite link, asked for as the dialog opens: the same one the bandmate joined by.
  const link = owner.getByText(new RegExp(`/join/${token}$`));
  await expect(link).toBeVisible();
  await owner.getByRole('button', { name: 'Remove Erik Editor' }).click();
  // The toast names the person, in the reader's language (it once crashed outside them).
  await expect(
    owner.getByText('Erik Editor is no longer in the playlist.'),
  ).toBeVisible();
  await owner.getByRole('button', { name: 'Undo' }).click();
  await expect(owner.getByRole('button', { name: 'Remove Erik Editor' })).toBeVisible();

  // A new link asks first (the old one stops working for everyone), then says so.
  await owner.getByRole('button', { name: 'Make a new link' }).click();
  await owner.getByRole('button', { name: 'Cancel' }).click();
  await expect(link).toBeVisible();
  await owner.getByRole('button', { name: 'Make a new link' }).click();
  await owner.getByRole('button', { name: 'Make a new one' }).click();
  await expect(owner.getByText('The new link is ready.', { exact: false })).toBeVisible();
  // The new link replaces the old one where it shows.
  await expect(link).toBeHidden();
  await expect(owner.getByText(/\/join\/\S+$/)).toBeVisible();
});

test('a listmate taken out while editing leaves the editor', async ({ browser }) => {
  const owner = await signedIn(browser, 'user@zpevnak.test');
  // Public: after being taken out, they can still see it, just not edit it.
  const { playlist, token } = await playlistWithInvite(owner, `Trh ${Date.now()}`, true);
  const listmate = await signedIn(browser, 'editor@zpevnak.test');
  await listmate.request.post('/trpc/playlists.join', { data: { token } });
  await listmate.goto(`/playlist/${playlist.id}`);
  await listmate.getByRole('button', { name: 'Edit playlist' }).click();
  await expect(listmate.getByLabel('Name')).toBeVisible();

  const me = await (await listmate.request.get('/trpc/auth.me')).json();
  await owner.request.post('/trpc/playlists.removeCollaborator', {
    data: { id: playlist.id, userId: me.result.data.id },
  });
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
  await fresh.request.post('/trpc/playlists.join', { data: { token } });
  await fresh.goto(`/playlist/${playlist.id}`);
  // Why they can't edit yet, and the way to fix it right there.
  await expect(fresh.getByRole('button', { name: 'Send the email again' })).toBeVisible();
  await fresh.getByRole('button', { name: 'Sharing' }).click();
  await expect(fresh.getByText('Uršula Uživatelová')).toBeVisible();
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
  await expect(owner.getByText('Only listmates see it.')).toBeVisible();
  await owner.getByText('Public', { exact: true }).click();
  // Once the server has it: who sees it, and the link just to look.
  await expect(
    owner.getByText('Anyone with the link can look', { exact: false }),
  ).toBeVisible();
  await expect(owner.getByText('Link to look')).toBeVisible();

  // Someone signed out with the invite: they can join, or only look.
  const stranger = await browser.newPage();
  await stranger.addInitScript(() => localStorage.setItem('zpevnak.locale', 'en'));
  await stranger.goto(`http://localhost:3101/join/${token}`);
  await stranger.getByRole('link', { name: 'Just look' }).click();
  await expect(
    stranger.getByRole('heading', { level: 1, name: playlist.name }),
  ).toBeVisible();
});
