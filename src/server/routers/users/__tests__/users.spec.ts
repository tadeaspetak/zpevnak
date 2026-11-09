import { describe, expect, it } from 'vitest';
import { callerFor, createUser, useCleanDatabase } from '#tests/server/helpers.ts';

useCleanDatabase();

describe('users', () => {
  it('lets an admin list users and change their roles', async () => {
    const admin = await createUser({ role: 'admin' });
    const user = await createUser();
    await callerFor(admin).users.setRole({ userId: user.id, role: 'editor' });
    const listed = await callerFor(admin).users.list();
    expect(listed.find((u) => u.id === user.id)).toMatchObject({ role: 'editor' });
    expect(Object.keys(listed[0] ?? {}).sort()).toEqual(
      ['createdAt', 'displayName', 'email', 'emailVerified', 'id', 'role'].sort(),
    );
  });

  it('is for admins only, not editors', async () => {
    const editor = await createUser({ role: 'editor' });
    const user = await createUser();
    await expect(callerFor(editor).users.list()).rejects.toThrow('FORBIDDEN');
    await expect(
      callerFor(editor).users.setRole({ userId: user.id, role: 'admin' }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it("refuses an admin's own role, so the last admin can't lock everyone out", async () => {
    const admin = await createUser({ role: 'admin' });
    await expect(
      callerFor(admin).users.setRole({ userId: admin.id, role: 'user' }),
    ).rejects.toThrow('CANNOT_CHANGE_OWN_ROLE');
  });

  it('says NOT_FOUND for an unknown user', async () => {
    const admin = await createUser({ role: 'admin' });
    await expect(
      callerFor(admin).users.setRole({ userId: 999_999, role: 'editor' }),
    ).rejects.toThrow('NOT_FOUND');
  });
});
