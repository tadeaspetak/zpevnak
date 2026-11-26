import { describe, expect, it } from 'vitest';
import type { SessionUser } from '../../../auth/sessions.ts';
import {
  callerFor,
  createUser,
  seenAt,
  SONG,
  useCleanDatabase,
} from '#tests/server/helpers.ts';

useCleanDatabase();

/**
 * A band's private playlist of two songs: its owner, a collaborator and a reader (each joined
 * by their link), and a stranger outside it.
 */
async function band(isPublic = false) {
  const owner = await createUser();
  const stranger = await createUser();
  const a = await callerFor(owner).songs.create({ source: SONG('A') });
  const b = await callerFor(owner).songs.create({ source: SONG('B') });
  const playlist = await callerFor(owner).playlists.create({
    name: 'Vršek',
    isPublic,
    songIds: [a.id, b.id],
  });
  const join = async (role: 'collaborator' | 'viewer') => {
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
    owner,
    stranger,
    a,
    b,
    playlist,
    collaborator: await join('collaborator'),
    reader: await join('viewer'),
  };
}

const note = (songId: number, playlistId: number | null = null) => ({
  songId,
  kind: playlistId === null ? ('own' as const) : ('playlist' as const),
  playlistId,
  text: 'refrén třikrát, konec na G',
  todo: false,
  line: { index: 3, text: 'la la la' },
});

const visibleIds = async (user: SessionUser | null) =>
  (await callerFor(user).notes.visible()).map((n) => n.id);

describe('notes on songs (D135)', () => {
  it('keeps one’s own note to oneself, a reader’s too', async () => {
    const { reader, owner, stranger, a } = await band();
    const mine = await callerFor(reader).notes.create({ ...note(a.id), todo: true });
    expect(mine).toMatchObject({
      songId: a.id,
      playlistId: null,
      authorId: reader.id,
      todo: true,
      doneAt: null,
      line: { index: 3, text: 'la la la' },
    });
    expect(await visibleIds(reader)).toEqual([mine.id]);
    for (const other of [owner, stranger, null]) {
      expect(await visibleIds(other)).toEqual([]);
      await expect(
        callerFor(other).notes.update({
          id: mine.id,
          text: 'x',
          todo: false,
          done: false,
        }),
      ).rejects.toThrow();
    }
  });

  it('lets anyone who edits the playlist add a note for it, the collaborator included', async () => {
    const { collaborator, owner, reader, a, playlist } = await band();
    const shared = await callerFor(collaborator).notes.create(note(a.id, playlist.id));
    expect(shared).toMatchObject({
      playlistId: playlist.id,
      authorName: expect.any(String),
    });
    for (const member of [owner, collaborator, reader]) {
      expect(await visibleIds(member)).toEqual([shared.id]);
    }
  });

  it('keeps a private playlist’s notes from outsiders and the songbook’s editors', async () => {
    const { owner, stranger, a, playlist } = await band();
    await callerFor(owner).notes.create(note(a.id, playlist.id));
    const editor = await createUser({ role: 'editor' });
    for (const outsider of [stranger, editor, null]) {
      expect(await visibleIds(outsider)).toEqual([]);
    }
  });

  it('shows a public playlist’s notes to every visitor, signed in or not', async () => {
    const { owner, stranger, a, playlist } = await band(true);
    const shared = await callerFor(owner).notes.create(note(a.id, playlist.id));
    expect(await visibleIds(stranger)).toEqual([shared.id]);
    expect(await visibleIds(null)).toEqual([shared.id]);
  });

  it('never shows a note on a private song to a visitor who can’t read the song', async () => {
    const { owner, stranger, playlist } = await band(true);
    const secret = await callerFor(owner).songs.create({
      source: SONG('Do šuplíku'),
      isPrivate: true,
    });
    await callerFor(owner).playlists.edit({
      id: playlist.id,
      op: { type: 'add', songId: secret.id, at: 2 },
    });
    const shared = await callerFor(owner).notes.create(note(secret.id, playlist.id));
    expect(await visibleIds(owner)).toEqual([shared.id]);
    expect(await visibleIds(stranger)).toEqual([]);
    expect(await visibleIds(null)).toEqual([]);
  });

  it('refuses a reader a note for the playlist, and a stranger any on a song not theirs to read', async () => {
    const { reader, stranger, owner, a, playlist } = await band();
    await expect(callerFor(reader).notes.create(note(a.id, playlist.id))).rejects.toThrow(
      'FORBIDDEN',
    );
    await expect(
      callerFor(stranger).notes.create(note(a.id, playlist.id)),
    ).rejects.toThrow('NOT_FOUND');
    const secret = await callerFor(owner).songs.create({
      source: SONG('Do šuplíku'),
      isPrivate: true,
    });
    await expect(callerFor(stranger).notes.create(note(secret.id))).rejects.toThrow(
      'NOT_FOUND',
    );
  });

  it('refuses a playlist note on a song the playlist doesn’t have', async () => {
    const { owner, playlist } = await band();
    const elsewhere = await callerFor(owner).songs.create({ source: SONG('Jinde') });
    await expect(
      callerFor(owner).notes.create(note(elsewhere.id, playlist.id)),
    ).rejects.toThrow('NOT_FOUND');
  });

  it('takes a line far down a long song, and refuses one past any song’s length', async () => {
    const { owner, a } = await band();
    const at = (index: number) =>
      callerFor(owner).notes.create({ ...note(a.id), line: { index, text: 'la' } });
    await expect(at(9_999)).resolves.toMatchObject({ line: { index: 9_999 } });
    await expect(at(3_000_000_000)).rejects.toThrow(/too_big|Too big/i);
  });

  it('keeps TODO to one’s own notes', async () => {
    const { owner, a, playlist } = await band();
    await expect(
      callerFor(owner).notes.create({ ...note(a.id, playlist.id), todo: true }),
    ).rejects.toThrow('NOTE_TODO_PRIVATE');
    const shared = await callerFor(owner).notes.create(note(a.id, playlist.id));
    await expect(
      callerFor(owner).notes.update({
        id: shared.id,
        text: 'x',
        todo: true,
        done: false,
      }),
    ).rejects.toThrow('NOTE_TODO_PRIVATE');
  });

  it('marks a TODO done and keeps when, until it is undone', async () => {
    const { owner, a } = await band();
    const api = callerFor(owner).notes;
    const todo = await api.create({ ...note(a.id), todo: true });
    const done = await api.update({
      id: todo.id,
      text: 'nový text',
      todo: true,
      done: true,
    });
    expect(done).toMatchObject({ text: 'nový text', doneAt: expect.any(String) });
    const again = await api.update({
      id: todo.id,
      text: 'nový text',
      todo: true,
      done: true,
    });
    expect(again.doneAt).toBe(done.doneAt);
    expect(
      (await api.update({ id: todo.id, text: 'nový text', todo: true, done: false }))
        .doneAt,
    ).toBeNull();
    // A note that stops being a TODO can't stay done.
    expect(
      await api.update({ id: todo.id, text: 'nový text', todo: false, done: true }),
    ).toMatchObject({ todo: false, doneAt: null });
  });

  it('lets any playlist editor change or delete its notes, a reader neither', async () => {
    const { owner, collaborator, reader, a, playlist } = await band();
    const shared = await callerFor(owner).notes.create(note(a.id, playlist.id));
    const change = { id: shared.id, text: 'dvakrát', todo: false, done: false };
    await expect(callerFor(reader).notes.update(change)).rejects.toThrow('FORBIDDEN');
    await expect(callerFor(reader).notes.delete({ id: shared.id })).rejects.toThrow(
      'FORBIDDEN',
    );
    await expect(callerFor(collaborator).notes.update(change)).resolves.toMatchObject({
      text: 'dvakrát',
      authorId: owner.id,
    });
    await expect(
      callerFor(collaborator).notes.delete({ id: shared.id }),
    ).resolves.toEqual({
      ok: true,
    });
    expect(await visibleIds(owner)).toEqual([]);
  });

  it('hides a playlist’s notes on a song taken out of it, and shows them when it is back', async () => {
    const { owner, a, playlist } = await band();
    const shared = await callerFor(owner).notes.create(note(a.id, playlist.id));
    await callerFor(owner).playlists.edit({
      id: playlist.id,
      op: { type: 'remove', songId: a.id, index: 0 },
    });
    expect(await visibleIds(owner)).toEqual([]);
    await callerFor(owner).playlists.edit({
      id: playlist.id,
      op: { type: 'add', songId: a.id, at: 0 },
    });
    expect(await visibleIds(owner)).toEqual([shared.id]);
  });

  it('goes with its song, and a playlist’s with the playlist', async () => {
    const { owner, a, b, playlist } = await band();
    const api = callerFor(owner).notes;
    await api.create(note(a.id));
    await api.create(note(b.id, playlist.id));
    const kept = await api.create(note(b.id));
    await callerFor(owner).playlists.delete({ id: playlist.id });
    const admin = await createUser({ role: 'admin' });
    await callerFor(admin).songs.delete({ id: a.id });
    expect(await visibleIds(owner)).toEqual([kept.id]);
  });
});

describe('reports of a mistake (D143)', () => {
  /** An approved song by its author, someone who reports a mistake in it, and the rest. */
  async function reported({ approved = true } = {}) {
    const author = await createUser();
    const editor = await createUser({ role: 'editor' });
    const reporter = await createUser();
    const player = await createUser();
    const song = await callerFor(author).songs.create({ source: SONG('Píseň') });
    if (approved) {
      await callerFor(editor).songs.verify({
        id: song.id,
        seenAt: await seenAt(song.id),
      });
    }
    const report = await callerFor(reporter).notes.create({
      songId: song.id,
      kind: 'report',
      playlistId: null,
      text: 've druhé sloce má být Hm, ne D',
      todo: false,
      line: { index: 1, text: 'la la la' },
    });
    return { author, editor, reporter, player, song, report };
  }

  it('shows an open report to its author, the editors and the song’s author, not to players', async () => {
    const { author, editor, reporter, player, report } = await reported();
    expect(report).toMatchObject({ kind: 'report', playlistId: null, resolvedAt: null });
    const admin = await createUser({ role: 'admin' });
    for (const sees of [reporter, editor, admin, author]) {
      expect(await visibleIds(sees)).toEqual([report.id]);
    }
    for (const doesNot of [player, null]) {
      expect(await visibleIds(doesNot)).toEqual([]);
    }
  });

  it('is resolved by an editor: it leaves the editors and the author, and stays its reporter’s', async () => {
    const { author, editor, reporter, report } = await reported();
    await callerFor(editor).notes.resolve({ id: report.id });
    expect(await visibleIds(editor)).toEqual([]);
    expect(await visibleIds(author)).toEqual([]);
    const [kept] = await callerFor(reporter).notes.visible();
    expect(kept?.resolvedAt).toEqual(expect.any(String));
    // What was reported is kept as it was; its reporter may still delete it.
    await expect(
      callerFor(reporter).notes.update({
        id: report.id,
        text: 'jinak',
        todo: false,
        done: false,
      }),
    ).rejects.toThrow('NOTE_RESOLVED');
    await callerFor(reporter).notes.delete({ id: report.id });
    expect(await visibleIds(reporter)).toEqual([]);
  });

  it('is resolved by whoever may change the song: its author while it isn’t approved', async () => {
    const pending = await reported({ approved: false });
    await callerFor(pending.author).notes.resolve({ id: pending.report.id });
    expect(await visibleIds(pending.editor)).toEqual([]);

    // An approved song is the songbook's: its author sees the report, an editor fixes it.
    const approved = await reported();
    await expect(
      callerFor(approved.author).notes.resolve({ id: approved.report.id }),
    ).rejects.toThrow('FORBIDDEN');
    await expect(
      callerFor(approved.reporter).notes.resolve({ id: approved.report.id }),
    ).rejects.toThrow('FORBIDDEN');
    await expect(
      callerFor(approved.player).notes.resolve({ id: approved.report.id }),
    ).rejects.toThrow('NOT_FOUND');
  });

  it('is changed by its reporter only: the editors resolve it, they don’t rewrite it', async () => {
    const { editor, reporter, report } = await reported();
    const change = { id: report.id, text: 've třetí sloce', todo: false, done: false };
    await expect(callerFor(editor).notes.update(change)).rejects.toThrow('FORBIDDEN');
    await expect(callerFor(editor).notes.delete({ id: report.id })).rejects.toThrow(
      'FORBIDDEN',
    );
    expect(await callerFor(reporter).notes.update(change)).toMatchObject({
      text: 've třetí sloce',
    });
    await expect(
      callerFor(reporter).notes.update({ ...change, todo: true }),
    ).rejects.toThrow('NOTE_TODO_PRIVATE');
  });

  it('isn’t made on a private song, which no editor reviews', async () => {
    const owner = await createUser();
    const song = await callerFor(owner).songs.create({ source: SONG(), isPrivate: true });
    await expect(
      callerFor(owner).notes.create({
        songId: song.id,
        kind: 'report',
        playlistId: null,
        text: 'chyba',
        todo: false,
        line: null,
      }),
    ).rejects.toThrow('NOTE_REPORT_PRIVATE');
  });

  it('names a playlist for a playlist’s note, and for no other', async () => {
    const { owner, a, playlist } = await band();
    await expect(
      callerFor(owner).notes.create({
        ...note(a.id),
        kind: 'report',
        playlistId: playlist.id,
      }),
    ).rejects.toThrow();
    await expect(
      callerFor(owner).notes.create({ ...note(a.id), kind: 'playlist' }),
    ).rejects.toThrow();
  });
});
