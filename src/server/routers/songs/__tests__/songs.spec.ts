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
  const author = await createUser();
  const other = await createUser();
  const editor = await createUser({ role: 'editor' });
  const song = await callerFor(author).songs.create({ source: SONG('Kočky', 'Nerez') });
  return { author, other, editor, song };
}

describe('songs.create', () => {
  it('stores a pending song with title and artist read from its header', async () => {
    const { song, author } = await setup();
    expect(song).toMatchObject({
      title: 'Kočky',
      artist: 'Nerez',
      status: 'pending',
      rejection: null,
      createdBy: author.id,
    });
  });

  it('falls back to {subtitle} for the artist, and allows no artist', async () => {
    const user = await createUser();
    const api = callerFor(user).songs;
    expect((await api.create({ source: '{t:A}\n{st:Sub}' })).artist).toBe('Sub');
    expect((await api.create({ source: '{t:B}' })).artist).toBeNull();
  });

  it('refuses a song without a title', async () => {
    const user = await createUser();
    await expect(
      callerFor(user).songs.create({ source: '{artist: x}\n[A]la' }),
    ).rejects.toThrow('SONG_HAS_NO_TITLE');
  });

  it('needs a signed-in, verified user', async () => {
    await expect(callerFor(null).songs.create({ source: SONG() })).rejects.toThrow(
      'NOT_SIGNED_IN',
    );
    const unverified = await createUser({ verified: false });
    await expect(callerFor(unverified).songs.create({ source: SONG() })).rejects.toThrow(
      'EMAIL_NOT_VERIFIED',
    );
  });

  it("starts an editor's own song as pending too", async () => {
    const editor = await createUser({ role: 'editor' });
    expect((await callerFor(editor).songs.create({ source: SONG() })).status).toBe(
      'pending',
    );
  });
});

describe('songs.update', () => {
  it('lets the author fix their pending song, re-reading the header', async () => {
    const { author, song } = await setup();
    const updated = await callerFor(author).songs.update({
      id: song.id,
      source: SONG('Kočky!', 'Nerez'),
    });
    expect(updated).toMatchObject({ title: 'Kočky!', status: 'pending' });
    expect(updated.updatedAt > song.updatedAt).toBe(true);
  });

  it("refuses someone else's song", async () => {
    const { other, song } = await setup();
    await expect(
      callerFor(other).songs.update({ id: song.id, source: SONG() }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('refuses the author once the song is verified', async () => {
    const { author, editor, song } = await setup();
    await callerFor(editor).songs.verify({ id: song.id });
    await expect(
      callerFor(author).songs.update({ id: song.id, source: SONG() }),
    ).rejects.toThrow('SONG_NOT_EDITABLE');
  });

  it('resubmits a rejected song as pending when its author fixes it', async () => {
    const { author, editor, song } = await setup();
    await callerFor(editor).songs.reject({ id: song.id, reason: 'too_many_mistakes' });
    const fixed = await callerFor(author).songs.update({ id: song.id, source: SONG() });
    expect(fixed).toMatchObject({ status: 'pending', rejection: null });
  });

  it('lets an editor edit any song, keeping its status', async () => {
    const { editor, song } = await setup();
    await callerFor(editor).songs.verify({ id: song.id });
    const edited = await callerFor(editor).songs.update({
      id: song.id,
      source: SONG('Fixed', 'Nerez'),
    });
    expect(edited).toMatchObject({ title: 'Fixed', status: 'verified' });
  });
});

describe('review', () => {
  it("verifies, saving the editor's last edits with it", async () => {
    const { editor, song } = await setup();
    const verified = await callerFor(editor).songs.verify({
      id: song.id,
      source: SONG('Kočky', 'Nerez & Co'),
    });
    expect(verified).toMatchObject({ status: 'verified', artist: 'Nerez & Co' });
  });

  it('rejects with a reason and note that the author and editors see, nobody else', async () => {
    const { author, other, editor, song } = await setup();
    await callerFor(editor).songs.reject({
      id: song.id,
      reason: 'totally_wrong',
      note: 'Wrong song entirely',
    });
    const rejection = { reason: 'totally_wrong', note: 'Wrong song entirely' };
    expect((await callerFor(author).songs.byId({ id: song.id })).rejection).toEqual(
      rejection,
    );
    expect((await callerFor(editor).songs.byId({ id: song.id })).rejection).toEqual(
      rejection,
    );
    await expect(callerFor(other).songs.byId({ id: song.id })).rejects.toThrow(
      'NOT_FOUND',
    );
    await expect(callerFor(null).songs.byId({ id: song.id })).rejects.toThrow(
      'NOT_FOUND',
    );
  });

  it('is for editors and admins only', async () => {
    const { author, song } = await setup();
    const admin = await createUser({ role: 'admin' });
    await expect(callerFor(author).songs.verify({ id: song.id })).rejects.toThrow(
      'FORBIDDEN',
    );
    await expect(callerFor(author).songs.queue({ status: 'pending' })).rejects.toThrow(
      'FORBIDDEN',
    );
    await expect(callerFor(admin).songs.verify({ id: song.id })).resolves.toMatchObject({
      status: 'verified',
    });
  });

  it('queues pending songs oldest first with their author, and rejected ones apart', async () => {
    const { author, editor, song } = await setup();
    const second = await callerFor(author).songs.create({ source: SONG('Second') });
    const third = await callerFor(author).songs.create({ source: SONG('Third') });
    await callerFor(editor).songs.reject({ id: third.id, reason: 'duplicate' });

    const pending = await callerFor(editor).songs.queue({ status: 'pending' });
    expect(pending.map((s) => s.id)).toEqual([song.id, second.id]);
    expect(pending[0]?.authorName).toBe(author.displayName);

    const rejected = await callerFor(editor).songs.queue({ status: 'rejected' });
    expect(rejected).toMatchObject([
      { id: third.id, rejectionReason: 'duplicate', reviewerName: editor.displayName },
    ]);
  });
});

describe('songs.sync', () => {
  it('gives anyone the pending and verified songs', async () => {
    const { editor, song } = await setup();
    const other = await callerFor(editor).songs.create({ source: SONG('Other') });
    await callerFor(editor).songs.verify({ id: other.id });

    const { songs, removedIds, cursor } = await callerFor(null).songs.sync({
      since: null,
    });
    expect(songs.map((s) => [s.id, s.status]).sort()).toEqual([
      [song.id, 'pending'],
      [other.id, 'verified'],
    ]);
    expect(removedIds).toEqual([]);
    expect(Date.parse(cursor)).not.toBeNaN();
  });

  it("keeps rejected songs out of everyone's catalog but the author's, editors included", async () => {
    const { author, editor, song } = await setup();
    await callerFor(editor).songs.reject({ id: song.id, reason: 'other' });

    const ids = async (user: Parameters<typeof callerFor>[0]) =>
      (await callerFor(user).songs.sync({ since: null })).songs.map((s) => s.id);
    expect(await ids(null)).toEqual([]);
    expect(await ids(editor)).toEqual([]);
    expect(await ids(author)).toEqual([song.id]);
  });

  it('since a cursor, sends what changed and the ids that left the catalog', async () => {
    const { author, editor, song } = await setup();
    const kept = await callerFor(author).songs.create({ source: SONG('Kept') });
    // Pretend both were synced long ago.
    await db.raw(`UPDATE songs SET updated_at = now() - interval '1 day'`);
    const { cursor } = await callerFor(null).songs.sync({ since: null });

    await callerFor(editor).songs.reject({ id: song.id, reason: 'duplicate' });
    await callerFor(author).songs.update({ id: kept.id, source: SONG('Kept, fixed') });

    const delta = await callerFor(null).songs.sync({ since: cursor });
    expect(delta.songs.map((s) => s.title)).toEqual(['Kept, fixed']);
    expect(delta.removedIds).toEqual([song.id]);
  });

  it('does not send rejection details to strangers', async () => {
    const { song } = await setup();
    const { songs } = await callerFor(null).songs.sync({ since: null });
    expect(Object.keys(songs[0] ?? {}).sort()).toEqual(
      [
        'artist',
        'createdAt',
        'createdBy',
        'id',
        'rejection',
        'source',
        'status',
        'title',
        'updatedAt',
      ].sort(),
    );
    expect(songs.find((s) => s.id === song.id)?.rejection).toBeNull();
  });
});
