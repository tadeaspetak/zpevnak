import { describe, expect, it } from 'vitest';
import { callerFor, createUser, SONG, useCleanDatabase } from '#tests/server/helpers.ts';

useCleanDatabase();

async function setup() {
  const owner = await createUser();
  const stranger = await createUser();
  const editor = await createUser({ role: 'editor' });
  const a = await callerFor(owner).songs.create({ source: SONG('A') });
  const b = await callerFor(owner).songs.create({ source: SONG('B') });
  const c = await callerFor(stranger).songs.create({ source: SONG('C') });
  return { owner, stranger, editor, a, b, c };
}

describe('playlists', () => {
  it('creates a playlist with songs in the given order, repeats allowed', async () => {
    const { owner, a, b, c } = await setup();
    const playlist = await callerFor(owner).playlists.create({
      name: 'Vršek 2026',
      isPublic: false,
      songIds: [c.id, a.id, b.id, a.id],
    });
    expect(playlist).toMatchObject({
      name: 'Vršek 2026',
      isPublic: false,
      isMine: true,
      ownerName: owner.displayName,
      songIds: [c.id, a.id, b.id, a.id],
    });
  });

  it('shows a private playlist to its owner only, and a public one to anyone', async () => {
    const { owner, stranger } = await setup();
    const api = callerFor(owner).playlists;
    const mine = await api.create({ name: 'Mine', isPublic: false });
    const shared = await api.create({ name: 'Shared', isPublic: true });

    await expect(callerFor(stranger).playlists.byId({ id: mine.id })).rejects.toThrow(
      'NOT_FOUND',
    );
    await expect(
      callerFor(null).playlists.byId({ id: shared.id }),
    ).resolves.toMatchObject({
      isMine: false,
    });
    expect((await callerFor(null).playlists.all()).map((p) => p.name)).toEqual([
      'Shared',
    ]);
    expect((await callerFor(owner).playlists.all()).map((p) => p.name).sort()).toEqual([
      'Mine',
      'Shared',
    ]);
  });

  it('lets the owner rename, reorder and share, field by field', async () => {
    const { owner, a, b } = await setup();
    const api = callerFor(owner).playlists;
    const playlist = await api.create({
      name: 'Set',
      isPublic: false,
      songIds: [a.id, b.id],
    });

    expect(await api.update({ id: playlist.id, songIds: [b.id, a.id] })).toMatchObject({
      name: 'Set',
      isPublic: false,
      songIds: [b.id, a.id],
    });
    expect(
      await api.update({ id: playlist.id, isPublic: true, name: 'Set 2' }),
    ).toMatchObject({
      name: 'Set 2',
      isPublic: true,
      songIds: [b.id, a.id],
    });
  });

  it("refuses changes to someone else's playlist, even an editor's", async () => {
    const { owner, stranger, editor } = await setup();
    const playlist = await callerFor(owner).playlists.create({
      name: 'Set',
      isPublic: true,
    });
    for (const user of [stranger, editor]) {
      await expect(
        callerFor(user).playlists.update({ id: playlist.id, name: 'Mine now' }),
      ).rejects.toThrow('FORBIDDEN');
      await expect(callerFor(user).playlists.delete({ id: playlist.id })).rejects.toThrow(
        'FORBIDDEN',
      );
    }
  });

  it('deletes the playlist', async () => {
    const { owner } = await setup();
    const api = callerFor(owner).playlists;
    const playlist = await api.create({ name: 'Set', isPublic: false });
    await api.delete({ id: playlist.id });
    await expect(api.byId({ id: playlist.id })).rejects.toThrow('NOT_FOUND');
  });

  it("can hold another user's pending song, but not their rejected one", async () => {
    const { owner, editor, c } = await setup();
    const api = callerFor(owner).playlists;
    await expect(
      api.create({ name: 'With C', isPublic: false, songIds: [c.id] }),
    ).resolves.toBeTruthy();

    await callerFor(editor).songs.reject({ id: c.id, reason: 'duplicate' });
    await expect(
      api.create({ name: 'With rejected C', isPublic: false, songIds: [c.id] }),
    ).rejects.toThrow('NOT_FOUND');
  });

  it("can hold its owner's own rejected song", async () => {
    const { owner, editor, a } = await setup();
    await callerFor(editor).songs.reject({ id: a.id, reason: 'other' });
    await expect(
      callerFor(owner).playlists.create({ name: 'x', isPublic: false, songIds: [a.id] }),
    ).resolves.toMatchObject({ songIds: [a.id] });
  });

  it('needs a verified account to create one', async () => {
    const unverified = await createUser({ verified: false });
    await expect(
      callerFor(unverified).playlists.create({ name: 'x', isPublic: false }),
    ).rejects.toThrow('EMAIL_NOT_VERIFIED');
  });
});
