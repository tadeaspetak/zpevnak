import { describe, expect, it } from 'vitest';
import type { JoinRole } from '#shared/roles.ts';
import type { SessionUser } from '../../../auth/sessions.ts';
import {
  callerFor,
  createUser,
  db,
  SONG,
  useCleanDatabase,
  seenAt,
} from '#tests/server/helpers.ts';

useCleanDatabase();

/** A private song of `owner`'s, an editor and an admin outside it, and a stranger. */
async function setup() {
  const owner = await createUser();
  const stranger = await createUser();
  const editor = await createUser({ role: 'editor' });
  const admin = await createUser({ role: 'admin' });
  const song = await callerFor(owner).songs.create({
    source: SONG('Naše', 'Kapela'),
    isPrivate: true,
  });
  return { owner, stranger, editor, admin, song };
}

/** Shares the song with a new person in `role`, through the owner's invite link. */
async function sharedWith(owner: SessionUser, songId: number, role: JoinRole) {
  const person = await createUser();
  const { token } = await callerFor(owner).sharing.invite({
    kind: 'song',
    id: songId,
    role,
  });
  await callerFor(person).sharing.join({ token });
  return person;
}

const syncedIds = async (user: SessionUser | null, since: string | null = null) =>
  (await callerFor(user).songs.sync({ since })).songs.map((s) => s.id);

describe('a private song', () => {
  it('is its owner’s, outside review: no queue, no pending', async () => {
    const { owner, editor, song } = await setup();
    expect(song).toMatchObject({ status: 'private', role: 'owner', createdBy: owner.id });
    const queue = await callerFor(editor).songs.queue({ status: 'pending' });
    expect(queue.map((s) => s.id)).not.toContain(song.id);
  });

  it('does not exist for anyone it isn’t shared with, the songbook’s editors included', async () => {
    const { stranger, editor, admin, song } = await setup();
    for (const user of [null, stranger, editor, admin]) {
      await expect(callerFor(user).songs.byId({ id: song.id })).rejects.toThrow(
        'NOT_FOUND',
      );
      expect(await syncedIds(user)).not.toContain(song.id);
    }
  });

  it('can’t be changed, reviewed or deleted by an editor outside it', async () => {
    const { editor, admin, song } = await setup();
    for (const user of [editor, admin]) {
      const api = callerFor(user).songs;
      const at = await seenAt(song.id);
      const refused = [
        () => api.update({ id: song.id, source: SONG('Jiná'), seenAt: at }),
        () => api.verify({ id: song.id, seenAt: at }),
        () => api.reject({ id: song.id, reason: 'duplicate', seenAt: at }),
        () => api.delete({ id: song.id }),
        () => api.setVisibility({ id: song.id, isPrivate: false }),
      ];
      for (const call of refused) {
        await expect(call()).rejects.toThrow('NOT_FOUND');
      }
    }
  });

  it('its owner edits, and it stays private', async () => {
    const { owner, song } = await setup();
    const saved = await callerFor(owner).songs.update({
      id: song.id,
      source: SONG('Naše nová', 'Kapela'),
      seenAt: await seenAt(song.id),
    });
    expect(saved).toMatchObject({ title: 'Naše nová', status: 'private' });
  });

  it('isn’t reviewed even by an editor it is shared with', async () => {
    const { owner, song } = await setup();
    const editor = await createUser({ role: 'editor' });
    const { token } = await callerFor(owner).sharing.invite({
      kind: 'song',
      id: song.id,
      role: 'collaborator',
    });
    await callerFor(editor).sharing.join({ token });
    await expect(
      callerFor(editor).songs.verify({ id: song.id, seenAt: await seenAt(song.id) }),
    ).rejects.toThrow('SONG_PRIVATE');
  });
});

describe('sharing a private song', () => {
  it('a reader reads it, on the device too, and can’t change it', async () => {
    const { owner, song } = await setup();
    const reader = await sharedWith(owner, song.id, 'viewer');
    expect(await callerFor(reader).songs.byId({ id: song.id })).toMatchObject({
      role: 'viewer',
    });
    expect(await syncedIds(reader)).toContain(song.id);
    await expect(
      callerFor(reader).songs.update({
        id: song.id,
        source: SONG('Moje'),
        seenAt: await seenAt(song.id),
      }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('a collaborator edits it, but only the owner deletes it', async () => {
    const { owner, song } = await setup();
    const collaborator = await sharedWith(owner, song.id, 'collaborator');
    await expect(
      callerFor(collaborator).songs.update({
        id: song.id,
        source: SONG('Naše lepší', 'Kapela'),
        seenAt: await seenAt(song.id),
      }),
    ).resolves.toMatchObject({ title: 'Naše lepší', status: 'private' });
    await expect(callerFor(collaborator).songs.delete({ id: song.id })).rejects.toThrow(
      'FORBIDDEN',
    );
    await expect(callerFor(owner).songs.delete({ id: song.id })).resolves.toEqual({
      ok: true,
    });
  });

  it('joins by a link that names the song, and answers with the song', async () => {
    const { owner, song } = await setup();
    const { token } = await callerFor(owner).sharing.invite({
      kind: 'song',
      id: song.id,
      role: 'viewer',
    });
    await expect(callerFor(null).sharing.invitePreview({ token })).resolves.toEqual({
      kind: 'song',
      name: 'Naše',
      ownerName: owner.displayName,
      publicId: null,
      role: 'viewer',
    });
    const reader = await createUser();
    await expect(callerFor(reader).sharing.join({ token })).resolves.toMatchObject({
      kind: 'song',
      song: { id: song.id, role: 'viewer' },
    });
  });

  it('lists its people to them, and lets them leave', async () => {
    const { owner, song } = await setup();
    const reader = await sharedWith(owner, song.id, 'viewer');
    const people = await callerFor(reader).sharing.members({ kind: 'song', id: song.id });
    expect(people.map((p) => p.role)).toEqual(['owner', 'viewer']);
    await callerFor(reader).sharing.leave({ kind: 'song', id: song.id });
    await expect(callerFor(reader).songs.byId({ id: song.id })).rejects.toThrow(
      'NOT_FOUND',
    );
  });

  it('keeps its links and people to its owner', async () => {
    const { owner, stranger, song } = await setup();
    const collaborator = await sharedWith(owner, song.id, 'collaborator');
    await expect(
      callerFor(collaborator).sharing.invite({
        kind: 'song',
        id: song.id,
        role: 'viewer',
      }),
    ).rejects.toThrow('FORBIDDEN');
    // Someone outside it doesn't learn it exists.
    await expect(
      callerFor(stranger).sharing.members({ kind: 'song', id: song.id }),
    ).rejects.toThrow('NOT_FOUND');
  });
});

describe('a private song’s links', () => {
  it('aren’t made for a public song, and lead nowhere while the song is public', async () => {
    const { owner, song } = await setup();
    const { token } = await callerFor(owner).sharing.invite({
      kind: 'song',
      id: song.id,
      role: 'viewer',
    });
    await callerFor(owner).songs.setVisibility({ id: song.id, isPrivate: false });
    await expect(
      callerFor(owner).sharing.invite({ kind: 'song', id: song.id, role: 'viewer' }),
    ).rejects.toThrow('SONG_NOT_PRIVATE');
    const late = await createUser();
    await expect(callerFor(late).sharing.join({ token })).rejects.toThrow(
      'INVALID_TOKEN',
    );
    await expect(callerFor(null).sharing.invitePreview({ token })).rejects.toThrow(
      'INVALID_TOKEN',
    );
    // Private again, the same link works again.
    await callerFor(owner).songs.setVisibility({ id: song.id, isPrivate: true });
    await expect(callerFor(late).sharing.join({ token })).resolves.toMatchObject({
      kind: 'song',
    });
  });

  it('lead nowhere once nobody owns the song (its author’s account gone)', async () => {
    const { owner, song } = await setup();
    const { token } = await callerFor(owner).sharing.invite({
      kind: 'song',
      id: song.id,
      role: 'viewer',
    });
    await db.raw(/* sql */ `DELETE FROM users WHERE id = :id`, { id: owner.id });
    await expect(callerFor(null).sharing.invitePreview({ token })).rejects.toThrow(
      'INVALID_TOKEN',
    );
    await expect(callerFor(await createUser()).sharing.join({ token })).rejects.toThrow(
      'INVALID_TOKEN',
    );
  });
});

describe('syncing private songs', () => {
  it('sends them whole every time, and not once access has ended', async () => {
    const { owner, song } = await setup();
    const reader = await sharedWith(owner, song.id, 'viewer');
    const { cursor } = await callerFor(reader).songs.sync({ since: null });
    // Unchanged since the cursor, and sent anyway: the device drops a private song not sent.
    expect(await syncedIds(reader, cursor)).toContain(song.id);
    await callerFor(owner).sharing.removeMember({
      kind: 'song',
      id: song.id,
      userId: reader.id,
    });
    expect(await syncedIds(reader, cursor)).not.toContain(song.id);
  });

  it('a song gone private leaves the devices of those who may not read it', async () => {
    const owner = await createUser();
    const song = await callerFor(owner).songs.create({ source: SONG('Omylem') });
    const { cursor } = await callerFor(null).songs.sync({ since: null });
    await callerFor(owner).songs.setVisibility({ id: song.id, isPrivate: true });
    const stranger = await callerFor(null).songs.sync({ since: cursor });
    expect(stranger.removedIds).toContain(song.id);
    expect(stranger.songs.map((s) => s.id)).not.toContain(song.id);
    // Its owner keeps it.
    const own = await callerFor(owner).songs.sync({ since: cursor });
    expect(own.removedIds).not.toContain(song.id);
    expect(own.songs.map((s) => s.id)).toContain(song.id);
  });

  it('deleting one tells nobody else its id', async () => {
    const { owner, song } = await setup();
    const { cursor } = await callerFor(null).songs.sync({ since: null });
    await callerFor(owner).songs.delete({ id: song.id });
    expect((await callerFor(null).songs.sync({ since: cursor })).removedIds).toEqual([]);
  });
});

describe('making a song public or private', () => {
  it('public is publishing: it goes to the editors as pending', async () => {
    const { owner, editor, song } = await setup();
    await expect(
      callerFor(owner).songs.setVisibility({ id: song.id, isPrivate: false }),
    ).resolves.toMatchObject({ status: 'pending' });
    const queue = await callerFor(editor).songs.queue({ status: 'pending' });
    expect(queue.map((s) => s.id)).toContain(song.id);
  });

  it('a song made public by mistake goes back, from its owner’s own playlist too', async () => {
    const owner = await createUser();
    const song = await callerFor(owner).songs.create({ source: SONG('Omylem') });
    await callerFor(owner).playlists.create({
      name: 'Moje',
      isPublic: false,
      songIds: [song.id],
    });
    await expect(
      callerFor(owner).songs.privateBlockers({ id: song.id }),
    ).resolves.toEqual({ editedByOthers: false, inOthersPlaylists: false });
    await expect(
      callerFor(owner).songs.setVisibility({ id: song.id, isPrivate: true }),
    ).resolves.toMatchObject({ status: 'private' });
  });

  it('not once an editor has worked on it', async () => {
    const owner = await createUser();
    const editor = await createUser({ role: 'editor' });
    const edited = await callerFor(owner).songs.create({ source: SONG('Upravená') });
    await callerFor(editor).songs.update({
      id: edited.id,
      source: SONG('Upravená', 'Opravdu'),
      seenAt: await seenAt(edited.id),
    });
    const approved = await callerFor(owner).songs.create({ source: SONG('Schválená') });
    await callerFor(editor).songs.verify({
      id: approved.id,
      seenAt: await seenAt(approved.id),
    });
    for (const song of [edited, approved]) {
      await expect(
        callerFor(owner).songs.privateBlockers({ id: song.id }),
      ).resolves.toMatchObject({ editedByOthers: true });
      await expect(
        callerFor(owner).songs.setVisibility({ id: song.id, isPrivate: true }),
      ).rejects.toThrow('SONG_EDITED_BY_OTHERS');
    }
  });

  it('not once it is in someone else’s playlist', async () => {
    const owner = await createUser();
    const other = await createUser();
    const song = await callerFor(owner).songs.create({ source: SONG('Oblíbená') });
    await callerFor(other).playlists.create({
      name: 'Cizí',
      isPublic: false,
      songIds: [song.id],
    });
    await expect(
      callerFor(owner).songs.setVisibility({ id: song.id, isPrivate: true }),
    ).rejects.toThrow('SONG_IN_OTHERS_PLAYLISTS');
  });

  it('only by its owner', async () => {
    const { owner, song } = await setup();
    const collaborator = await sharedWith(owner, song.id, 'collaborator');
    await expect(
      callerFor(collaborator).songs.setVisibility({ id: song.id, isPrivate: false }),
    ).rejects.toThrow('FORBIDDEN');
    await expect(
      callerFor(collaborator).songs.privateBlockers({ id: song.id }),
    ).rejects.toThrow('FORBIDDEN');
  });
});

/** A private playlist of `owner`'s with a reader and a collaborator, joined by its links. */
async function bandPlaylist(owner: SessionUser, isPublic = false) {
  const playlist = await callerFor(owner).playlists.create({
    name: 'Kapela',
    isPublic,
    songIds: [],
  });
  const join = async (role: JoinRole) => {
    const person = await createUser();
    const { token } = await callerFor(owner).sharing.invite({
      kind: 'playlist',
      id: playlist.id,
      role,
    });
    await callerFor(person).sharing.join({ token });
    return person;
  };
  return {
    playlist,
    reader: await join('viewer'),
    collaborator: await join('collaborator'),
  };
}

describe('a playlist shares its private songs with its people (D128)', () => {
  it('its owner puts it in, and everyone in the playlist reads it, on the device too', async () => {
    const { owner, song } = await setup();
    const { playlist, reader, collaborator } = await bandPlaylist(owner);
    await callerFor(owner).playlists.edit({
      id: playlist.id,
      op: { type: 'add', songId: song.id },
    });
    for (const person of [reader, collaborator]) {
      // Read through the playlist: no role in the song, no say in it.
      expect(await callerFor(person).songs.byId({ id: song.id })).toMatchObject({
        role: null,
      });
      expect(await syncedIds(person)).toContain(song.id);
      expect(
        (await callerFor(person).playlists.byId({ id: playlist.id })).songIds,
      ).toEqual([song.id]);
      await expect(
        callerFor(person).songs.update({
          id: song.id,
          source: SONG('Moje'),
          seenAt: await seenAt(song.id),
        }),
      ).rejects.toThrow('FORBIDDEN');
    }
  });

  it('for as long as they are in it, and the song is', async () => {
    const { owner, song } = await setup();
    const { playlist, reader, collaborator } = await bandPlaylist(owner);
    await callerFor(owner).playlists.edit({
      id: playlist.id,
      op: { type: 'add', songId: song.id },
    });
    await callerFor(reader).sharing.leave({ kind: 'playlist', id: playlist.id });
    await expect(callerFor(reader).songs.byId({ id: song.id })).rejects.toThrow(
      'NOT_FOUND',
    );
    await callerFor(owner).playlists.edit({
      id: playlist.id,
      op: { type: 'remove', songId: song.id, index: 0 },
    });
    await expect(callerFor(collaborator).songs.byId({ id: song.id })).rejects.toThrow(
      'NOT_FOUND',
    );
    expect(await syncedIds(collaborator)).not.toContain(song.id);
  });

  it('outside a public playlist, nobody learns it is there, not even its place', async () => {
    const { owner, stranger, editor, song } = await setup();
    const other = await callerFor(owner).songs.create({ source: SONG('Veřejná') });
    const { playlist } = await bandPlaylist(owner, true);
    for (const songId of [song.id, other.id]) {
      await callerFor(owner).playlists.edit({
        id: playlist.id,
        op: { type: 'add', songId },
      });
    }
    for (const user of [null, stranger, editor]) {
      expect((await callerFor(user).playlists.byId({ id: playlist.id })).songIds).toEqual(
        [other.id],
      );
      await expect(callerFor(user).songs.byId({ id: song.id })).rejects.toThrow(
        'NOT_FOUND',
      );
    }
  });

  it('reaches nobody new through a playlist its owner isn’t in', async () => {
    // A reader puts it into a playlist of their own (allowed: they alone are in it), then
    // invites someone: that person doesn't get the song.
    const { owner, song } = await setup();
    const { playlist: band, reader } = await bandPlaylist(owner);
    await callerFor(owner).playlists.edit({
      id: band.id,
      op: { type: 'add', songId: song.id },
    });
    const own = await callerFor(reader).playlists.create({
      name: 'Moje',
      isPublic: false,
      songIds: [song.id],
    });
    const { token } = await callerFor(reader).sharing.invite({
      kind: 'playlist',
      id: own.id,
      role: 'viewer',
    });
    const outsider = await createUser();
    await callerFor(outsider).sharing.join({ token });
    await expect(callerFor(outsider).songs.byId({ id: song.id })).rejects.toThrow(
      'NOT_FOUND',
    );
    expect((await callerFor(outsider).playlists.byId({ id: own.id })).songIds).toEqual(
      [],
    );
    // The reader still reads it, through the band.
    expect((await callerFor(reader).playlists.byId({ id: own.id })).songIds).toEqual([
      song.id,
    ]);
  });

  it('leaves with its owner: out of the band, their songs stay theirs', async () => {
    const bandleader = await createUser();
    const { playlist, reader } = await bandPlaylist(bandleader);
    const { token } = await callerFor(bandleader).sharing.invite({
      kind: 'playlist',
      id: playlist.id,
      role: 'collaborator',
    });
    const songwriter = await createUser();
    await callerFor(songwriter).sharing.join({ token });
    const song = await callerFor(songwriter).songs.create({
      source: SONG('Moje'),
      isPrivate: true,
    });
    await callerFor(songwriter).playlists.edit({
      id: playlist.id,
      op: { type: 'add', songId: song.id },
    });
    expect(await syncedIds(reader)).toContain(song.id);
    await callerFor(songwriter).sharing.leave({ kind: 'playlist', id: playlist.id });
    expect(await syncedIds(reader)).not.toContain(song.id);
  });

  it('only its owner passes it on: someone it is shared with may not', async () => {
    const { owner, song } = await setup();
    const friend = await sharedWith(owner, song.id, 'collaborator');
    const { playlist } = await bandPlaylist(friend);
    await expect(
      callerFor(friend).playlists.edit({
        id: playlist.id,
        op: { type: 'add', songId: song.id },
      }),
    ).rejects.toThrow('PRIVATE_SONG_NOT_SHARED');
  });

  it('anyone who reads it may add it where everyone already can', async () => {
    const { owner, song } = await setup();
    const { playlist, collaborator } = await bandPlaylist(owner);
    await callerFor(owner).playlists.edit({
      id: playlist.id,
      op: { type: 'add', songId: song.id },
    });
    // Its people read it through this playlist already: a second time passes nothing on.
    await expect(
      callerFor(collaborator).playlists.edit({
        id: playlist.id,
        op: { type: 'add', songId: song.id },
      }),
    ).resolves.toMatchObject({ songIds: [song.id, song.id] });
    // And into a new playlist of their own, where they are the only one.
    await expect(
      callerFor(collaborator).playlists.create({
        name: 'Moje',
        isPublic: false,
        songIds: [song.id],
      }),
    ).resolves.toMatchObject({ songIds: [song.id] });
  });

  it('is unknown to someone who may not read it', async () => {
    const { stranger, song } = await setup();
    await expect(
      callerFor(stranger).playlists.create({
        name: 'Cizí',
        isPublic: false,
        songIds: [song.id],
      }),
    ).rejects.toThrow('NOT_FOUND');
    const { rows } = await db.raw(/* sql */ `SELECT count(*)::int AS n FROM playlists`);
    expect(rows[0].n).toBe(0);
  });
});
