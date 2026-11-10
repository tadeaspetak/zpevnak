import { describe, expect, it } from 'vitest';
import {
  callerFor,
  createUser,
  db,
  SONG,
  useCleanDatabase,
} from '#tests/server/helpers.ts';

useCleanDatabase();

/** A song's versions, oldest first, as stored. */
async function versionsOf(songId: number) {
  const { rows } = await db.raw(
    /* sql */ `
      SELECT kind, source, title, artist, saved_by AS "savedBy"
      FROM song_versions WHERE song_id = :songId ORDER BY id
    `,
    { songId },
  );
  return rows;
}

async function setup() {
  const author = await createUser();
  const editor = await createUser({ role: 'editor' });
  const song = await callerFor(author).songs.create({ source: SONG('Kočky', 'Nerez') });
  return { author, editor, song };
}

describe('song versions (D86)', () => {
  it('records a new song as its first version, by its author', async () => {
    const { author, song } = await setup();
    expect(await versionsOf(song.id)).toEqual([
      {
        kind: 'create',
        source: SONG('Kočky', 'Nerez'),
        title: 'Kočky',
        artist: 'Nerez',
        savedBy: author.id,
      },
    ]);
  });

  it('records each edit that changes the text, by whoever made it', async () => {
    const { author, editor, song } = await setup();
    await callerFor(author).songs.update({
      id: song.id,
      source: SONG('Kočky!', 'Nerez'),
    });
    await callerFor(editor).songs.update({
      id: song.id,
      source: SONG('Kočky!!', 'Nerez'),
    });
    const versions = await versionsOf(song.id);
    expect(versions.map((v: { kind: string }) => v.kind)).toEqual([
      'create',
      'edit',
      'edit',
    ]);
    expect(versions[1]).toMatchObject({ title: 'Kočky!', savedBy: author.id });
    expect(versions[2]).toMatchObject({
      source: SONG('Kočky!!', 'Nerez'),
      title: 'Kočky!!',
      savedBy: editor.id,
    });
  });

  it('records nothing for a save that leaves the text as it was', async () => {
    const { author, song } = await setup();
    await callerFor(author).songs.update({ id: song.id, source: SONG('Kočky', 'Nerez') });
    expect(await versionsOf(song.id)).toHaveLength(1);
  });

  it('records a resubmitted rejected song as an edit', async () => {
    const { author, editor, song } = await setup();
    await callerFor(editor).songs.reject({ id: song.id, reason: 'too_many_mistakes' });
    await callerFor(author).songs.update({
      id: song.id,
      source: SONG('Kočky', 'Nerez, opraveno'),
    });
    const versions = await versionsOf(song.id);
    expect(versions.map((v: { kind: string }) => v.kind)).toEqual([
      'create',
      'reject',
      'edit',
    ]);
  });

  it('records every approval with the approved text, edited or not', async () => {
    const { editor, song } = await setup();
    await callerFor(editor).songs.verify({ id: song.id });
    const other = await callerFor(editor).songs.create({ source: SONG('Jiná', 'Někdo') });
    await callerFor(editor).songs.verify({
      id: other.id,
      source: SONG('Jiná!', 'Někdo'),
    });

    expect(await versionsOf(song.id)).toMatchObject([
      { kind: 'create' },
      { kind: 'approve', source: SONG('Kočky', 'Nerez'), savedBy: editor.id },
    ]);
    expect(await versionsOf(other.id)).toMatchObject([
      { kind: 'create' },
      {
        kind: 'approve',
        source: SONG('Jiná!', 'Někdo'),
        title: 'Jiná!',
        savedBy: editor.id,
      },
    ]);
  });

  it('records a rejection with the text it turned down, and why', async () => {
    const { editor, song } = await setup();
    await callerFor(editor).songs.reject({
      id: song.id,
      reason: 'duplicate',
      note: 'Už je',
    });
    const { rows } = await db.raw(
      /* sql */ `
        SELECT kind, source, saved_by AS "savedBy", rejection_reason AS reason,
               rejection_note AS note
        FROM song_versions WHERE song_id = :id ORDER BY id
      `,
      { id: song.id },
    );
    expect(rows).toEqual([
      {
        kind: 'create',
        source: SONG('Kočky', 'Nerez'),
        savedBy: rows[0].savedBy,
        reason: null,
        note: null,
      },
      {
        kind: 'reject',
        source: SONG('Kočky', 'Nerez'),
        savedBy: editor.id,
        reason: 'duplicate',
        note: 'Už je',
      },
    ]);
  });

  it('records nothing when a save is refused', async () => {
    const { song } = await setup();
    const stranger = await createUser();
    await expect(
      callerFor(stranger).songs.update({ id: song.id, source: SONG('Cizí', 'Nerez') }),
    ).rejects.toThrow('FORBIDDEN');
    expect(await versionsOf(song.id)).toHaveLength(1);
  });

  it("deletes a song's versions with it", async () => {
    const { editor, song } = await setup();
    await callerFor(editor).songs.update({
      id: song.id,
      source: SONG('Kočky!', 'Nerez'),
    });
    await callerFor(editor).songs.delete({ id: song.id });
    expect(await versionsOf(song.id)).toEqual([]);
  });

  it("keeps a song's versions when the person who saved them leaves", async () => {
    const { author, song } = await setup();
    await db.raw(/* sql */ `DELETE FROM users WHERE id = :id`, { id: author.id });
    expect(await versionsOf(song.id)).toMatchObject([{ kind: 'create', savedBy: null }]);
  });
});
