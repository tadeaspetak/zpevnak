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
  await owner.getByRole('button', { name: 'Listmates' }).click();
  // The invite link, asked for as the dialog opens: the same one the bandmate joined by.
  const link = owner.getByRole('textbox', { name: 'Copy link' });
  await expect(link).toHaveValue(new RegExp(`/join/${token}$`));
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
  await expect(link).toHaveValue(new RegExp(`/join/${token}$`));
  await owner.getByRole('button', { name: 'Make a new link' }).click();
  await owner.getByRole('button', { name: 'Make a new one' }).click();
  await expect(owner.getByText('The new link is ready.', { exact: false })).toBeVisible();
  await expect(link).not.toHaveValue(new RegExp(`/join/${token}$`));
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
  await fresh.getByRole('button', { name: 'Listmates' }).click();
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
