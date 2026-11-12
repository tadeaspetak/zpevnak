import { expect, test } from '@playwright/test';
import { signedIn } from './helpers.ts';

test('an admin changes someone’s role from the account’s Users tab', async ({
  browser,
}) => {
  const admin = await signedIn(browser, 'admin@zpevnak.test');
  await admin.goto('/account');
  await admin.getByRole('tab', { name: 'Users' }).click();
  // The tab is in the address, so a reload stays on it.
  await expect(admin).toHaveURL(/tab=users/);

  // The device's own picker (D115): a plain select, one per person.
  const row = admin.locator('.mantine-Group-root', { hasText: 'new@zpevnak.test' });
  const role = row.getByRole('combobox', { name: 'Role' });
  await expect(role).toHaveValue('user');
  await role.selectOption('editor');
  await expect(admin.getByText('Nový Nepotvrzený is now Editor')).toBeVisible();

  await admin.reload();
  await expect(role).toHaveValue('editor');
  // Back as it was, for the other tests on this database.
  await role.selectOption('user');
  await expect(admin.getByText('Nový Nepotvrzený is now User')).toBeVisible();

  // Nobody changes their own role.
  const own = admin.locator('.mantine-Group-root', { hasText: 'admin@zpevnak.test' });
  await expect(own.getByRole('combobox', { name: 'Role' })).toBeDisabled();
});
