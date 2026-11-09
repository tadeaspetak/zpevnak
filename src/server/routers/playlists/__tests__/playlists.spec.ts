import { describe, expect, it } from 'vitest';
import {
  callerFor,
  createUser,
  db,
  SONG,
  useCleanDatabase,
} from '#tests/server/helpers.ts';

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

/** A playlist with a collaborator who joined through the invite link. */
async function shared() {
  const s = await setup();
  const collaborator = await createUser();
  const playlist = await callerFor(s.owner).playlists.create({
    name: 'Vánoce',
    isPublic: false,
    songIds: [s.a.id, s.b.id],
  });
  const { token } = await callerFor(s.owner).playlists.invite({ id: playlist.id });
  await callerFor(collaborator).playlists.join({ token });
  return { ...s, collaborator, playlist, token };
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
      role: 'owner',
      collaboratorCount: 0,
      ownerName: owner.displayName,
      songIds: [c.id, a.id, b.id, a.id],
    });
  });

  it('shows a private playlist to its members only, and a public one to anyone', async () => {
    const { owner, stranger } = await setup();
    const api = callerFor(owner).playlists;
    const mine = await api.create({ name: 'Mine', isPublic: false });
    const open = await api.create({ name: 'Open', isPublic: true });

    await expect(callerFor(stranger).playlists.byId({ id: mine.id })).rejects.toThrow(
      'NOT_FOUND',
    );
    await expect(callerFor(null).playlists.byId({ id: open.id })).resolves.toMatchObject({
      role: null,
    });
    expect((await callerFor(null).playlists.all()).map((p) => p.name)).toEqual(['Open']);
    expect((await api.all()).map((p) => p.name).sort()).toEqual(['Mine', 'Open']);
  });

  it('never sends the invite token in a playlist record', async () => {
    const { owner, playlist } = await shared();
    const record = await callerFor(owner).playlists.byId({ id: playlist.id });
    expect(Object.keys(record).sort()).toEqual(
      [
        'collaboratorCount',
        'id',
        'isPublic',
        'name',
        'ownerName',
        'role',
        'songIds',
        'updatedAt',
      ].sort(),
    );
  });

  it('deletes the playlist, owner only', async () => {
    const { owner, collaborator, playlist } = await shared();
    await expect(
      callerFor(collaborator).playlists.delete({ id: playlist.id }),
    ).rejects.toThrow('FORBIDDEN');
    await callerFor(owner).playlists.delete({ id: playlist.id });
    await expect(callerFor(owner).playlists.byId({ id: playlist.id })).rejects.toThrow(
      'NOT_FOUND',
    );
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

  it('needs a verified account to create one', async () => {
    const unverified = await createUser({ verified: false });
    await expect(
      callerFor(unverified).playlists.create({ name: 'x', isPublic: false }),
    ).rejects.toThrow('EMAIL_NOT_VERIFIED');
  });
});

describe('editing the songs', () => {
  it('adds, removes and moves, one operation at a time', async () => {
    const { owner, playlist, a, b, c } = await shared();
    const api = callerFor(owner).playlists;
    const id = playlist.id;
    expect((await api.edit({ id, op: { type: 'add', songId: c.id } })).songIds).toEqual([
      a.id,
      b.id,
      c.id,
    ]);
    expect(
      (await api.edit({ id, op: { type: 'move', songId: c.id, from: 2, to: 0 } }))
        .songIds,
    ).toEqual([c.id, a.id, b.id]);
    expect(
      (await api.edit({ id, op: { type: 'remove', songId: a.id, index: 1 } })).songIds,
    ).toEqual([c.id, b.id]);
  });

  it('two people editing at once both keep their change', async () => {
    const { owner, collaborator, playlist, a, b, c } = await shared();
    // Both saw [a, b]. One adds c; the other, at the same time, removes b.
    await Promise.all([
      callerFor(owner).playlists.edit({
        id: playlist.id,
        op: { type: 'add', songId: c.id },
      }),
      callerFor(collaborator).playlists.edit({
        id: playlist.id,
        op: { type: 'remove', songId: b.id, index: 1 },
      }),
    ]);
    const after = await callerFor(owner).playlists.byId({ id: playlist.id });
    expect(after.songIds).toEqual([a.id, c.id]);
  });

  it('lets a collaborator edit songs and rename, not delete or change visibility', async () => {
    const { collaborator, playlist, c } = await shared();
    const api = callerFor(collaborator).playlists;
    await expect(
      api.edit({ id: playlist.id, op: { type: 'add', songId: c.id } }),
    ).resolves.toMatchObject({ role: 'collaborator' });
    await expect(
      api.rename({ id: playlist.id, name: 'Vánoce 2026' }),
    ).resolves.toMatchObject({
      name: 'Vánoce 2026',
    });
    await expect(api.setPublic({ id: playlist.id, isPublic: true })).rejects.toThrow(
      'FORBIDDEN',
    );
  });

  it("refuses strangers and editors who aren't in the playlist, even on a public one", async () => {
    const { owner, stranger, editor, a } = await setup();
    const playlist = await callerFor(owner).playlists.create({
      name: 'Open',
      isPublic: true,
    });
    for (const user of [stranger, editor]) {
      await expect(
        callerFor(user).playlists.edit({
          id: playlist.id,
          op: { type: 'add', songId: a.id },
        }),
      ).rejects.toThrow('FORBIDDEN');
      await expect(
        callerFor(user).playlists.rename({ id: playlist.id, name: 'Mine now' }),
      ).rejects.toThrow('FORBIDDEN');
    }
  });

  it("refuses adding a song the editor can't see", async () => {
    const { owner, editor, playlist, c } = await shared();
    await callerFor(editor).songs.reject({ id: c.id, reason: 'duplicate' });
    await expect(
      callerFor(owner).playlists.edit({
        id: playlist.id,
        op: { type: 'add', songId: c.id },
      }),
    ).rejects.toThrow('NOT_FOUND');
  });
});

describe('sharing', () => {
  it('joins through the invite link: the private playlist appears, as a collaborator', async () => {
    const { collaborator, playlist } = await shared();
    const mine = await callerFor(collaborator).playlists.all();
    expect(mine).toMatchObject([{ id: playlist.id, role: 'collaborator' }]);
    expect(
      (await callerFor(collaborator).playlists.byId({ id: playlist.id }))
        .collaboratorCount,
    ).toBe(1);
  });

  it('lets an unconfirmed account join (it may edit once its email is confirmed)', async () => {
    const { token, playlist, a } = await shared();
    const fresh = await createUser({ verified: false });
    await expect(callerFor(fresh).playlists.join({ token })).resolves.toMatchObject({
      role: 'collaborator',
    });
    await expect(
      callerFor(fresh).playlists.edit({
        id: playlist.id,
        op: { type: 'add', songId: a.id },
      }),
    ).rejects.toThrow('EMAIL_NOT_VERIFIED');
  });

  it('keeps one invite link until the owner replaces it; the old one then fails', async () => {
    const { owner, playlist, token } = await shared();
    expect((await callerFor(owner).playlists.invite({ id: playlist.id })).token).toBe(
      token,
    );
    const { token: fresh } = await callerFor(owner).playlists.resetInvite({
      id: playlist.id,
    });
    expect(fresh).not.toBe(token);
    const late = await createUser();
    await expect(callerFor(late).playlists.join({ token })).rejects.toThrow(
      'INVALID_TOKEN',
    );
    await expect(callerFor(late).playlists.join({ token: fresh })).resolves.toBeTruthy();
  });

  it("previews an invite's playlist to anyone holding the link, signed in or not", async () => {
    const { owner, token } = await shared();
    await expect(callerFor(null).playlists.invitePreview({ token })).resolves.toEqual({
      name: 'Vánoce',
      ownerName: owner.displayName,
    });
    await expect(
      callerFor(null).playlists.invitePreview({ token: 'x'.repeat(22) }),
    ).rejects.toThrow('INVALID_TOKEN');
  });

  it('keeps the invite link to the owner', async () => {
    const { collaborator, playlist } = await shared();
    await expect(
      callerFor(collaborator).playlists.invite({ id: playlist.id }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('joining twice, or the owner opening their own link, changes nothing', async () => {
    const { owner, collaborator, token, playlist } = await shared();
    await callerFor(collaborator).playlists.join({ token });
    await expect(callerFor(owner).playlists.join({ token })).resolves.toMatchObject({
      role: 'owner',
    });
    expect(
      (await callerFor(owner).playlists.byId({ id: playlist.id })).collaboratorCount,
    ).toBe(1);
  });

  it('lists the members, owner first, to members only', async () => {
    const { owner, collaborator, stranger, playlist } = await shared();
    expect(await callerFor(collaborator).playlists.members({ id: playlist.id })).toEqual([
      { id: owner.id, displayName: owner.displayName, role: 'owner' },
      {
        id: collaborator.id,
        displayName: collaborator.displayName,
        role: 'collaborator',
      },
    ]);
    await expect(
      callerFor(stranger).playlists.members({ id: playlist.id }),
    ).rejects.toThrow('NOT_FOUND');
  });

  it('lets a collaborator leave, and the owner remove one', async () => {
    const { owner, collaborator, playlist, token } = await shared();
    await callerFor(collaborator).playlists.leave({ id: playlist.id });
    await expect(
      callerFor(collaborator).playlists.byId({ id: playlist.id }),
    ).rejects.toThrow('NOT_FOUND');
    await callerFor(collaborator).playlists.join({ token });
    await callerFor(owner).playlists.removeCollaborator({
      id: playlist.id,
      userId: collaborator.id,
    });
    expect(
      (await callerFor(owner).playlists.byId({ id: playlist.id })).collaboratorCount,
    ).toBe(0);
  });

  it("doesn't let the owner leave, or a collaborator remove anyone", async () => {
    const { owner, collaborator, playlist } = await shared();
    await expect(callerFor(owner).playlists.leave({ id: playlist.id })).rejects.toThrow(
      'FORBIDDEN',
    );
    await expect(
      callerFor(collaborator).playlists.removeCollaborator({
        id: playlist.id,
        userId: owner.id,
      }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('a deleted user drops out of the playlists they collaborated on', async () => {
    const { collaborator, owner, playlist } = await shared();
    await db.raw(`DELETE FROM users WHERE id = ?`, [collaborator.id]);
    expect(
      (await callerFor(owner).playlists.byId({ id: playlist.id })).collaboratorCount,
    ).toBe(0);
  });
});

describe('a rejected song in a playlist', () => {
  /** Owner's playlist [a, b, c, d]; c is the stranger's song, rejected. */
  async function withRejected() {
    const s = await setup();
    const d = await callerFor(s.owner).songs.create({ source: SONG('D') });
    const playlist = await callerFor(s.owner).playlists.create({
      name: 'Gig',
      isPublic: true,
      songIds: [s.a.id, s.b.id, s.c.id, d.id],
    });
    await callerFor(s.editor).songs.reject({ id: s.c.id, reason: 'totally_wrong' });
    return { ...s, d, playlist };
  }

  it('is hidden from everyone but its author: not in the list, not in the count', async () => {
    const { owner, stranger, a, b, c, d, playlist } = await withRejected();
    expect((await callerFor(owner).playlists.byId({ id: playlist.id })).songIds).toEqual([
      a.id,
      b.id,
      d.id,
    ]);
    expect((await callerFor(null).playlists.byId({ id: playlist.id })).songIds).toEqual([
      a.id,
      b.id,
      d.id,
    ]);
    // Its author sees it, in its place.
    expect(
      (await callerFor(stranger).playlists.byId({ id: playlist.id })).songIds,
    ).toEqual([a.id, b.id, c.id, d.id]);
  });

  it('keeps its place while others edit around it', async () => {
    const { owner, stranger, a, b, c, d, playlist } = await withRejected();
    // The owner sees [a, b, d] and moves d to the top.
    await callerFor(owner).playlists.edit({
      id: playlist.id,
      op: { type: 'move', songId: d.id, from: 2, to: 0 },
    });
    expect(
      (await callerFor(stranger).playlists.byId({ id: playlist.id })).songIds,
    ).toEqual([d.id, a.id, b.id, c.id]);
  });

  it('comes back in its place once fixed and approved', async () => {
    const { owner, stranger, editor, a, b, c, d, playlist } = await withRejected();
    await callerFor(stranger).songs.update({ id: c.id, source: SONG('C, fixed') });
    await callerFor(editor).songs.verify({ id: c.id });
    expect((await callerFor(owner).playlists.byId({ id: playlist.id })).songIds).toEqual([
      a.id,
      b.id,
      c.id,
      d.id,
    ]);
  });
});
