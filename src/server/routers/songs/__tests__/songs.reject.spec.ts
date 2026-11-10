import { describe, expect, it } from 'vitest';
import { testOutbox } from '#server/email/send.ts';
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
  const author = await createUser();
  const editor = await createUser({ role: 'editor' });
  const song = await callerFor(author).songs.create({ source: SONG('Kočky', 'Nerez') });
  return { author, editor, song };
}

describe('songs.reject', () => {
  it('needs a note for "other", which says nothing by itself', async () => {
    const { editor, song } = await setup();
    await expect(
      callerFor(editor).songs.reject({
        id: song.id,
        seenAt: await seenAt(song.id),
        reason: 'other',
      }),
    ).rejects.toThrow('REJECTION_NOTE_REQUIRED');
    await expect(
      callerFor(editor).songs.reject({
        id: song.id,
        seenAt: await seenAt(song.id),
        reason: 'other',
        note: '   ',
      }),
    ).rejects.toThrow('REJECTION_NOTE_REQUIRED');
    const { rows } = await db.raw(`SELECT status FROM songs WHERE id = :id`, {
      id: song.id,
    });
    expect(rows[0].status).toBe('pending');
  });

  it('takes "other" with a note, and any other reason without one', async () => {
    const { editor, song } = await setup();
    const rejected = await callerFor(editor).songs.reject({
      id: song.id,
      seenAt: await seenAt(song.id),
      reason: 'other',
      note: 'Chybí druhá sloka',
    });
    expect(rejected.rejection).toEqual({ reason: 'other', note: 'Chybí druhá sloka' });
    const second = await callerFor(editor).songs.create({ source: SONG('Jiná') });
    const plain = await callerFor(editor).songs.reject({
      id: second.id,
      seenAt: await seenAt(second.id),
      reason: 'duplicate',
    });
    expect(plain.rejection).toEqual({ reason: 'duplicate', note: null });
  });

  it('emails the author why, in their language, with the way to fix it', async () => {
    const { author, editor, song } = await setup();
    await callerFor(editor).songs.reject({
      id: song.id,
      seenAt: await seenAt(song.id),
      reason: 'too_many_mistakes',
      note: 'Akordy v refrénu nesedí',
    });
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0]).toMatchObject({
      to: author.email,
      subject: 'Písnička „Kočky“ potřebuje opravit',
    });
    expect(testOutbox[0]?.text).toContain('příliš mnoho chyb\nAkordy v refrénu nesedí');
    expect(testOutbox[0]?.text).toContain(`/song/${song.id}/edit`);
  });

  it('gives the note as the reason for "other"', async () => {
    const { editor, song } = await setup();
    await callerFor(editor).songs.reject({
      id: song.id,
      seenAt: await seenAt(song.id),
      reason: 'other',
      note: 'Jiná píseň',
    });
    expect(testOutbox[0]?.text).toContain('neschválil.\n\nJiná píseň\n\n');
  });

  it('emails nobody when the editor rejects their own song', async () => {
    const { editor } = await setup();
    const own = await callerFor(editor).songs.create({ source: SONG('Moje') });
    await callerFor(editor).songs.reject({
      id: own.id,
      seenAt: await seenAt(own.id),
      reason: 'duplicate',
    });
    expect(testOutbox).toEqual([]);
  });

  it('keeps the rejection in the history, and the queue shows it once the song is fixed', async () => {
    const { author, editor, song } = await setup();
    const untouched = await callerFor(author).songs.create({ source: SONG('Nová') });
    await callerFor(editor).songs.reject({
      id: song.id,
      seenAt: await seenAt(song.id),
      reason: 'totally_wrong',
      note: 'Jiná melodie',
    });
    await callerFor(author).songs.update({
      id: song.id,
      seenAt: await seenAt(song.id),
      source: SONG('Kočky', 'Opraveno'),
    });

    const queue = await callerFor(editor).songs.queue({ status: 'pending' });
    expect(queue.map((s) => [s.id, s.lastRejection])).toEqual([
      [song.id, { reason: 'totally_wrong', note: 'Jiná melodie' }],
      [untouched.id, null],
    ]);
    // The fixed song itself has forgotten the rejection (D81).
    expect((await callerFor(author).songs.byId({ id: song.id })).rejection).toBeNull();
  });
});
