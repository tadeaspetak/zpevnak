import { describe, expect, it } from 'vitest';
import {
  callerFor,
  createUser,
  db,
  SONG,
  useCleanDatabase,
  seenAt,
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
  const { token } = await callerFor(s.owner).sharing.invite({
    kind: 'playlist',
    id: playlist.id,
    role: 'collaborator',
  });
  await callerFor(collaborator).sharing.join({ token });
  return { ...s, collaborator, playlist, token };
}

describe('playlists', () => {
  it('puts a song back at its place, for an undone removal', async () => {
    const { owner, a, b, c } = await setup();
    const playlist = await callerFor(owner).playlists.create({
      name: 'Zpátky',
      isPublic: false,
      songIds: [a.id, b.id, c.id],
    });
    await callerFor(owner).playlists.edit({
      id: playlist.id,
      op: { type: 'remove', songId: b.id, index: 1 },
    });
    const back = await callerFor(owner).playlists.edit({
      id: playlist.id,
      op: { type: 'add', songId: b.id, at: 1 },
    });
    expect(back.songIds).toEqual([a.id, b.id, c.id]);
  });

  it('says a full playlist is full, and still takes songs out of it', async () => {
    const { owner, a, b } = await setup();
    const playlist = await callerFor(owner).playlists.create({
      name: 'Dlouhá noc',
      isPublic: false,
      songIds: [],
    });
    await db.raw(
      /* sql */ `
        INSERT INTO playlist_songs (playlist_id, position, song_id)
        SELECT :id, n, :songId FROM generate_series(1, 500) n
      `,
      { id: playlist.id, songId: a.id },
    );
    await expect(
      callerFor(owner).playlists.edit({
        id: playlist.id,
        op: { type: 'add', songId: b.id },
      }),
    ).rejects.toThrow('PLAYLIST_FULL');
    const fewer = await callerFor(owner).playlists.edit({
      id: playlist.id,
      op: { type: 'remove', songId: a.id, index: 0 },
    });
    expect(fewer.songIds).toHaveLength(499);
  });

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
      listmateCount: 0,
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
        'listmateCount',
        'id',
        'isPublic',
        'name',
        'ownerName',
        'role',
        'songIds',
        'songKeys',
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
    await callerFor(editor).songs.reject({
      id: c.id,
      seenAt: await seenAt(c.id),
      reason: 'duplicate',
    });
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
    await callerFor(editor).songs.reject({
      id: c.id,
      seenAt: await seenAt(c.id),
      reason: 'duplicate',
    });
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
      (await callerFor(collaborator).playlists.byId({ id: playlist.id })).listmateCount,
    ).toBe(1);
  });

  it("tells the playlist's own people how many collaborators it has, nobody else", async () => {
    const { owner, collaborator, stranger, playlist } = await shared();
    await callerFor(owner).playlists.setPublic({ id: playlist.id, isPublic: true });
    for (const member of [owner, collaborator]) {
      expect(
        (await callerFor(member).playlists.byId({ id: playlist.id })).listmateCount,
      ).toBe(1);
    }
    for (const outsider of [stranger, null]) {
      expect(
        (await callerFor(outsider).playlists.byId({ id: playlist.id })).listmateCount,
      ).toBeNull();
    }
  });

  it('lets an unconfirmed account that joined see who is in, and leave again', async () => {
    const { token, playlist } = await shared();
    const fresh = await createUser({ verified: false });
    await callerFor(fresh).sharing.join({ token });
    await expect(
      callerFor(fresh).sharing.members({ kind: 'playlist', id: playlist.id }),
    ).resolves.toContainEqual(expect.objectContaining({ id: fresh.id }));
    await expect(
      callerFor(fresh).sharing.leave({ kind: 'playlist', id: playlist.id }),
    ).resolves.toBeTruthy();
  });

  it('lets an unconfirmed account join (it may edit once its email is confirmed)', async () => {
    const { token, playlist, a } = await shared();
    const fresh = await createUser({ verified: false });
    await expect(callerFor(fresh).sharing.join({ token })).resolves.toMatchObject({
      kind: 'playlist',
      playlist: { role: 'collaborator' },
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
    expect(
      (
        await callerFor(owner).sharing.invite({
          kind: 'playlist',
          id: playlist.id,
          role: 'collaborator',
        })
      ).token,
    ).toBe(token);
    const { token: fresh } = await callerFor(owner).sharing.resetInvite({
      kind: 'playlist',
      id: playlist.id,
      role: 'collaborator',
    });
    expect(fresh).not.toBe(token);
    const late = await createUser();
    await expect(callerFor(late).sharing.join({ token })).rejects.toThrow(
      'INVALID_TOKEN',
    );
    await expect(callerFor(late).sharing.join({ token: fresh })).resolves.toBeTruthy();
  });

  it("previews an invite's playlist to anyone holding the link, signed in or not", async () => {
    const { owner, token, playlist } = await shared();
    await expect(callerFor(null).sharing.invitePreview({ token })).resolves.toEqual({
      kind: 'playlist',
      name: 'Vánoce',
      ownerName: owner.displayName,
      // Private: nothing to look at without joining, and no id to look for.
      publicId: null,
      role: 'collaborator',
    });
    await callerFor(owner).playlists.setPublic({ id: playlist.id, isPublic: true });
    await expect(callerFor(null).sharing.invitePreview({ token })).resolves.toMatchObject(
      {
        publicId: playlist.id,
      },
    );
    await expect(
      callerFor(null).sharing.invitePreview({ token: 'x'.repeat(22) }),
    ).rejects.toThrow('INVALID_TOKEN');
  });

  it('keeps the invite link to the owner', async () => {
    const { collaborator, playlist } = await shared();
    await expect(
      callerFor(collaborator).sharing.invite({
        kind: 'playlist',
        id: playlist.id,
        role: 'collaborator',
      }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('joining twice, or the owner opening their own link, changes nothing', async () => {
    const { owner, collaborator, token, playlist } = await shared();
    await callerFor(collaborator).sharing.join({ token });
    await expect(callerFor(owner).sharing.join({ token })).resolves.toMatchObject({
      playlist: { role: 'owner' },
    });
    expect(
      (await callerFor(owner).playlists.byId({ id: playlist.id })).listmateCount,
    ).toBe(1);
  });

  it('lists the members, owner first, to members only', async () => {
    const { owner, collaborator, stranger, playlist } = await shared();
    expect(
      await callerFor(collaborator).sharing.members({
        kind: 'playlist',
        id: playlist.id,
      }),
    ).toEqual([
      { id: owner.id, displayName: owner.displayName, role: 'owner' },
      {
        id: collaborator.id,
        displayName: collaborator.displayName,
        role: 'collaborator',
      },
    ]);
    await expect(
      callerFor(stranger).sharing.members({ kind: 'playlist', id: playlist.id }),
    ).rejects.toThrow('NOT_FOUND');
  });

  it('lets a collaborator leave, and the owner remove one', async () => {
    const { owner, collaborator, playlist, token } = await shared();
    await callerFor(collaborator).sharing.leave({ kind: 'playlist', id: playlist.id });
    await expect(
      callerFor(collaborator).playlists.byId({ id: playlist.id }),
    ).rejects.toThrow('NOT_FOUND');
    await callerFor(collaborator).sharing.join({ token });
    await callerFor(owner).sharing.removeMember({
      kind: 'playlist',
      id: playlist.id,
      userId: collaborator.id,
    });
    expect(
      (await callerFor(owner).playlists.byId({ id: playlist.id })).listmateCount,
    ).toBe(0);
  });

  it("doesn't let the owner leave, or a collaborator remove anyone", async () => {
    const { owner, collaborator, playlist } = await shared();
    await expect(
      callerFor(owner).sharing.leave({ kind: 'playlist', id: playlist.id }),
    ).rejects.toThrow('FORBIDDEN');
    await expect(
      callerFor(collaborator).sharing.removeMember({
        kind: 'playlist',
        id: playlist.id,
        userId: owner.id,
      }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('a deleted user drops out of the playlists they collaborated on', async () => {
    const { collaborator, owner, playlist } = await shared();
    await db.raw(`DELETE FROM users WHERE id = ?`, [collaborator.id]);
    expect(
      (await callerFor(owner).playlists.byId({ id: playlist.id })).listmateCount,
    ).toBe(0);
  });
});

describe('readers', () => {
  /** A private playlist with a collaborator, and a reader who joined by the reading link. */
  async function withReader() {
    const s = await shared();
    const reader = await createUser();
    const { token: viewToken } = await callerFor(s.owner).sharing.invite({
      kind: 'playlist',
      id: s.playlist.id,
      role: 'viewer',
    });
    await callerFor(reader).sharing.join({ token: viewToken });
    return { ...s, reader, viewToken };
  }

  it('join by the reading link, and see the private playlist and its songs', async () => {
    const { reader, playlist, a, b } = await withReader();
    expect(await callerFor(reader).playlists.byId({ id: playlist.id })).toMatchObject({
      role: 'viewer',
      songIds: [a.id, b.id],
      // In it, so they see who else is: the collaborator and themselves.
      listmateCount: 2,
    });
    expect((await callerFor(reader).playlists.all()).map((p) => p.id)).toContain(
      playlist.id,
    );
  });

  it("can't change the songs or the name, and nothing else the owner keeps", async () => {
    const { reader, playlist, c } = await withReader();
    const api = callerFor(reader).playlists;
    const share = callerFor(reader).sharing;
    // Each started only as it is awaited: none rejects with nobody listening.
    const refused = [
      () => api.edit({ id: playlist.id, op: { type: 'add', songId: c.id } }),
      () => api.rename({ id: playlist.id, name: 'Moje' }),
      () => api.setPublic({ id: playlist.id, isPublic: true }),
      () => share.invite({ kind: 'playlist', id: playlist.id, role: 'viewer' }),
      () => api.delete({ id: playlist.id }),
    ];
    for (const call of refused) {
      await expect(call()).rejects.toThrow('FORBIDDEN');
    }
  });

  it('leaves the collaborator editing, beside a reader', async () => {
    const { collaborator, playlist, c } = await withReader();
    const api = callerFor(collaborator).playlists;
    await expect(
      api.edit({ id: playlist.id, op: { type: 'add', songId: c.id } }),
    ).resolves.toMatchObject({ role: 'collaborator' });
    await expect(api.rename({ id: playlist.id, name: 'Vršek' })).resolves.toMatchObject({
      name: 'Vršek',
    });
  });

  it('lists each person with their role, to a reader too, and lets a reader leave', async () => {
    const { owner, collaborator, reader, playlist } = await withReader();
    expect(
      await callerFor(reader).sharing.members({ kind: 'playlist', id: playlist.id }),
    ).toEqual([
      { id: owner.id, displayName: owner.displayName, role: 'owner' },
      {
        id: collaborator.id,
        displayName: collaborator.displayName,
        role: 'collaborator',
      },
      { id: reader.id, displayName: reader.displayName, role: 'viewer' },
    ]);
    await callerFor(reader).sharing.leave({ kind: 'playlist', id: playlist.id });
    await expect(callerFor(reader).playlists.byId({ id: playlist.id })).rejects.toThrow(
      'NOT_FOUND',
    );
  });

  it('a link to edit makes a reader a collaborator; a link to read takes nothing away', async () => {
    const { owner, collaborator, reader, playlist, token, viewToken } =
      await withReader();
    await callerFor(collaborator).sharing.join({ token: viewToken });
    await callerFor(owner).sharing.join({ token: viewToken });
    await callerFor(reader).sharing.join({ token });
    const roles = (
      await callerFor(owner).sharing.members({ kind: 'playlist', id: playlist.id })
    ).map((m) => m.role);
    expect(roles).toEqual(['owner', 'collaborator', 'collaborator']);
  });

  it('keeps one link per role, each replaced on its own', async () => {
    const { owner, playlist, token, viewToken } = await withReader();
    const share = callerFor(owner).sharing;
    expect(viewToken).not.toBe(token);
    expect(
      (await share.invite({ kind: 'playlist', id: playlist.id, role: 'viewer' })).token,
    ).toBe(viewToken);
    const { token: freshView } = await share.resetInvite({
      kind: 'playlist',
      id: playlist.id,
      role: 'viewer',
    });
    expect(
      (await share.invite({ kind: 'playlist', id: playlist.id, role: 'collaborator' }))
        .token,
    ).toBe(token);
    const late = await createUser();
    await expect(callerFor(late).sharing.join({ token: viewToken })).rejects.toThrow(
      'INVALID_TOKEN',
    );
    await expect(
      callerFor(late).sharing.join({ token: freshView }),
    ).resolves.toMatchObject({ playlist: { role: 'viewer' } });
  });

  it("previews the reading link, saying it's for reading", async () => {
    const { viewToken } = await withReader();
    await expect(
      callerFor(null).sharing.invitePreview({ token: viewToken }),
    ).resolves.toMatchObject({ name: 'Vánoce', role: 'viewer' });
  });

  it('the owner changes who edits and who reads; nobody else can', async () => {
    const { owner, collaborator, reader, playlist, c } = await withReader();
    const share = callerFor(owner).sharing;
    await share.setRole({
      kind: 'playlist',
      id: playlist.id,
      userId: reader.id,
      role: 'collaborator',
    });
    await share.setRole({
      kind: 'playlist',
      id: playlist.id,
      userId: collaborator.id,
      role: 'viewer',
    });
    await expect(
      callerFor(reader).playlists.edit({
        id: playlist.id,
        op: { type: 'add', songId: c.id },
      }),
    ).resolves.toBeTruthy();
    await expect(
      callerFor(collaborator).playlists.edit({
        id: playlist.id,
        op: { type: 'add', songId: c.id },
      }),
    ).rejects.toThrow('FORBIDDEN');
    await expect(
      callerFor(reader).sharing.setRole({
        kind: 'playlist',
        id: playlist.id,
        userId: collaborator.id,
        role: 'collaborator',
      }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it("can't make anyone a member by giving them a role", async () => {
    const { owner, playlist } = await withReader();
    const stranger = await createUser();
    await expect(
      callerFor(owner).sharing.setRole({
        kind: 'playlist',
        id: playlist.id,
        userId: stranger.id,
        role: 'viewer',
      }),
    ).rejects.toThrow('NOT_FOUND');
    await expect(callerFor(stranger).playlists.byId({ id: playlist.id })).rejects.toThrow(
      'NOT_FOUND',
    );
  });

  it('an undone removal puts a reader back as a reader', async () => {
    const { owner, reader, playlist } = await withReader();
    const share = callerFor(owner).sharing;
    await share.removeMember({ kind: 'playlist', id: playlist.id, userId: reader.id });
    await share.restoreMember({ kind: 'playlist', id: playlist.id, userId: reader.id });
    expect((await callerFor(reader).playlists.byId({ id: playlist.id })).role).toBe(
      'viewer',
    );
  });
});

describe('undoing a removal (D87)', () => {
  async function removed() {
    const s = await shared();
    const { rows } = await db.raw(
      /* sql */ `SELECT joined_at FROM playlist_collaborators WHERE user_id = :id`,
      { id: s.collaborator.id },
    );
    const record = await callerFor(s.owner).sharing.removeMember({
      kind: 'playlist',
      id: s.playlist.id,
      userId: s.collaborator.id,
    });
    return { ...s, joinedAt: rows[0].joined_at as Date, record };
  }
  const memberIds = async (owner: Parameters<typeof callerFor>[0], id: number) =>
    (await callerFor(owner).sharing.members({ kind: 'playlist', id })).map((m) => m.id);

  it('removes at once and answers with the playlist, one fewer', async () => {
    const { record, owner, playlist, collaborator } = await removed();
    expect(record).toMatchObject({ playlist: { listmateCount: 0 } });
    expect(await memberIds(owner, playlist.id)).not.toContain(collaborator.id);
  });

  it('puts the person back as they were, original join date included', async () => {
    const { owner, playlist, collaborator, joinedAt } = await removed();
    const record = await callerFor(owner).sharing.restoreMember({
      kind: 'playlist',
      id: playlist.id,
      userId: collaborator.id,
    });
    expect(record).toMatchObject({ playlist: { listmateCount: 1 } });
    const { rows } = await db.raw(
      /* sql */ `SELECT joined_at FROM playlist_collaborators WHERE user_id = :id`,
      { id: collaborator.id },
    );
    expect(rows[0].joined_at).toEqual(joinedAt);
    expect((await callerFor(collaborator).playlists.byId({ id: playlist.id })).role).toBe(
      'collaborator',
    );
  });

  it('undoes once: a second undo has nothing left to undo', async () => {
    const { owner, playlist, collaborator } = await removed();
    const share = callerFor(owner).sharing;
    await share.restoreMember({
      kind: 'playlist',
      id: playlist.id,
      userId: collaborator.id,
    });
    await expect(
      share.restoreMember({ kind: 'playlist', id: playlist.id, userId: collaborator.id }),
    ).rejects.toThrow('UNDO_EXPIRED');
  });

  it("works when they've come back through the link meanwhile", async () => {
    const { owner, playlist, collaborator, token } = await removed();
    await callerFor(collaborator).sharing.join({ token });
    const record = await callerFor(owner).sharing.restoreMember({
      kind: 'playlist',
      id: playlist.id,
      userId: collaborator.id,
    });
    expect(record).toMatchObject({ playlist: { listmateCount: 1 } });
  });

  it('refuses once the window has passed', async () => {
    const { owner, playlist, collaborator } = await removed();
    await db.raw(/* sql */ `
        UPDATE playlist_collaborator_removals SET removed_at = now() - interval '11 minutes'
      `);
    await expect(
      callerFor(owner).sharing.restoreMember({
        kind: 'playlist',
        id: playlist.id,
        userId: collaborator.id,
      }),
    ).rejects.toThrow('UNDO_EXPIRED');
  });

  it("can't add someone who was never taken out of the playlist", async () => {
    const { owner, stranger, playlist } = await removed();
    await expect(
      callerFor(owner).sharing.restoreMember({
        kind: 'playlist',
        id: playlist.id,
        userId: stranger.id,
      }),
    ).rejects.toThrow('UNDO_EXPIRED');
    expect(await memberIds(owner, playlist.id)).not.toContain(stranger.id);
  });

  it("is the owner's alone", async () => {
    const { owner, stranger, playlist, collaborator, token } = await removed();
    await callerFor(stranger).sharing.join({ token });
    await expect(
      callerFor(stranger).sharing.restoreMember({
        kind: 'playlist',
        id: playlist.id,
        userId: collaborator.id,
      }),
    ).rejects.toThrow('FORBIDDEN');
    expect(await memberIds(owner, playlist.id)).not.toContain(collaborator.id);
  });
});

describe('a rejected song in a playlist', () => {
  it('stays in every playlist, in its place, marked: nobody loses a song (D77)', async () => {
    const { owner, stranger, editor, a, b, c } = await setup();
    const playlist = await callerFor(owner).playlists.create({
      name: 'Gig',
      isPublic: true,
      songIds: [a.id, b.id, c.id],
    });
    await callerFor(editor).songs.reject({
      id: c.id,
      seenAt: await seenAt(c.id),
      reason: 'totally_wrong',
    });
    for (const viewer of [owner, stranger, null]) {
      expect(
        (await callerFor(viewer).playlists.byId({ id: playlist.id })).songIds,
      ).toEqual([a.id, b.id, c.id]);
    }
    expect(await callerFor(null).songs.byId({ id: c.id })).toMatchObject({
      status: 'rejected',
    });
  });
});

describe('a key per playlist (D131)', () => {
  /** A playlist of the owner's with songs a and b, a collaborator and a reader in it. */
  async function band() {
    const s = await shared();
    const reader = await createUser();
    const { token } = await callerFor(s.owner).sharing.invite({
      kind: 'playlist',
      id: s.playlist.id,
      role: 'viewer',
    });
    await callerFor(reader).sharing.join({ token });
    return { ...s, reader };
  }

  it('is set by whoever may edit the playlist, and everyone in it gets it', async () => {
    const { collaborator, reader, playlist, a } = await band();
    await expect(
      callerFor(collaborator).playlists.setSongKey({
        id: playlist.id,
        songId: a.id,
        semitones: -2,
        from: 9,
      }),
    ).resolves.toMatchObject({ songKeys: { [a.id]: { semitones: -2, from: 9 } } });
    for (const who of [reader, collaborator]) {
      expect((await callerFor(who).playlists.byId({ id: playlist.id })).songKeys).toEqual(
        {
          [a.id]: { semitones: -2, from: 9 },
        },
      );
    }
    // And in the sync of all playlists, as the device gets it.
    const all = await callerFor(reader).playlists.all();
    expect(all.find((p) => p.id === playlist.id)?.songKeys).toEqual({
      [a.id]: { semitones: -2, from: 9 },
    });
  });

  it('not by a reader, nor by anyone outside', async () => {
    const { reader, stranger, playlist, a } = await band();
    const key = { id: playlist.id, songId: a.id, semitones: 2, from: 9 };
    await expect(callerFor(reader).playlists.setSongKey(key)).rejects.toThrow(
      'FORBIDDEN',
    );
    await expect(callerFor(stranger).playlists.setSongKey(key)).rejects.toThrow(
      'NOT_FOUND',
    );
  });

  it('only for a song in the playlist', async () => {
    const { owner, playlist, c } = await band();
    await expect(
      callerFor(owner).playlists.setSongKey({
        id: playlist.id,
        songId: c.id,
        semitones: 2,
        from: null,
      }),
    ).rejects.toThrow('NOT_FOUND');
  });

  it('stays through a reorder, goes back to the song’s own at 0, and leaves with the song', async () => {
    const { owner, playlist, a, b } = await band();
    const api = callerFor(owner).playlists;
    await api.setSongKey({ id: playlist.id, songId: a.id, semitones: 3, from: 0 });
    await api.edit({
      id: playlist.id,
      op: { type: 'move', songId: a.id, from: 0, to: 1 },
    });
    expect((await api.byId({ id: playlist.id })).songKeys).toEqual({
      [a.id]: { semitones: 3, from: 0 },
    });
    await api.setSongKey({ id: playlist.id, songId: b.id, semitones: 5, from: null });
    await api.setSongKey({ id: playlist.id, songId: b.id, semitones: 0, from: null });
    expect(Object.keys((await api.byId({ id: playlist.id })).songKeys)).toEqual([
      String(a.id),
    ]);
    await api.edit({ id: playlist.id, op: { type: 'remove', songId: a.id, index: 1 } });
    expect((await api.byId({ id: playlist.id })).songKeys).toEqual({});
  });
});
