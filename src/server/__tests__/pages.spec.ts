import { readFileSync } from 'node:fs';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { url } from '#shared/urls.ts';
import { pages, withLinkPreview } from '../pages.ts';
import {
  callerFor,
  createUser,
  db,
  SONG,
  useCleanDatabase,
} from '#tests/server/helpers.ts';

useCleanDatabase();

// The real shell: the tags a preview replaces must be in it.
const shell = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const app = express().use(pages(db, async () => shell));

const ogTag = (html: string, property: string) =>
  new RegExp(`<meta\\s+property="${property}"\\s+content="([^"]*)"`).exec(html)?.[1];

async function invite(name: string) {
  const owner = await createUser();
  await db.raw(/* sql */ `UPDATE users SET display_name = 'Bára' WHERE id = :id`, {
    id: owner.id,
  });
  const playlist = await callerFor(owner).playlists.create({
    name,
    isPublic: false,
    songIds: [],
  });
  return (await callerFor(owner).playlists.invite({ id: playlist.id })).token;
}

describe('the pages', () => {
  it("names an invite's playlist and owner where its link is shared", async () => {
    const token = await invite('Vánoce');
    const res = await request(app).get(url.join(token)).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(ogTag(res.text, 'og:title')).toBe('Pozvánka do playlistu „Vánoce“');
    expect(ogTag(res.text, 'og:description')).toBe(
      'Bára tě zve, ať se přidáš k playlistu „Vánoce“ na Zpěvňáku.',
    );
    // The tab keeps the app's name, as on every other page.
    expect(res.text).toContain('<title>Zpěvňák</title>');
  });

  it('names a song by its title and artist, by any link to it', async () => {
    const owner = await createUser();
    const song = await callerFor(owner).songs.create({ source: SONG('Lalala', 'Bára') });
    for (const path of [
      url.song(song),
      `/song/${song.id}`,
      `/song/${song.id}-old-slug`,
    ]) {
      const res = await request(app).get(path).expect(200);
      expect(ogTag(res.text, 'og:title')).toBe('Lalala · Bára');
      expect(ogTag(res.text, 'og:description')).toBe('Text a akordy na Zpěvňáku.');
    }
  });

  it('names a public playlist, its owner and its songs, and a song in it', async () => {
    const owner = await createUser();
    await db.raw(/* sql */ `UPDATE users SET display_name = 'Bára' WHERE id = :id`, {
      id: owner.id,
    });
    const a = await callerFor(owner).songs.create({ source: SONG('Lalala', 'Bára') });
    const b = await callerFor(owner).songs.create({ source: SONG('Tralala', 'Bára') });
    const playlist = await callerFor(owner).playlists.create({
      name: 'Vánoce',
      isPublic: true,
      songIds: [a.id, b.id],
    });

    const list = await request(app).get(url.playlist(playlist)).expect(200);
    expect(ogTag(list.text, 'og:title')).toBe('Vánoce');
    expect(ogTag(list.text, 'og:description')).toBe(
      'Bára · playlist na Zpěvňáku · 2\u00a0písničky',
    );

    const second = await request(app).get(url.playlistSong(playlist, 2)).expect(200);
    expect(ogTag(second.text, 'og:title')).toBe('Tralala · Bára');
    expect(ogTag(second.text, 'og:description')).toBe(
      '2. písnička z playlistu „Vánoce“ na Zpěvňáku.',
    );

    // A place with no song: the playlist's own preview.
    for (const position of [3, 0]) {
      const res = await request(app)
        .get(url.playlistSong(playlist, position))
        .expect(200);
      expect(ogTag(res.text, 'og:title')).toBe('Vánoce');
    }
  });

  it('counts the songs in Czech', async () => {
    const owner = await createUser();
    const song = await callerFor(owner).songs.create({ source: SONG() });
    for (const [count, words] of [
      [0, '0\u00a0písniček'],
      [1, '1\u00a0písnička'],
      [5, '5\u00a0písniček'],
    ] as const) {
      const playlist = await callerFor(owner).playlists.create({
        name: `P${count}`,
        isPublic: true,
        songIds: Array.from({ length: count }, () => song.id),
      });
      const res = await request(app).get(url.playlist(playlist)).expect(200);
      expect(ogTag(res.text, 'og:description')).toMatch(new RegExp(`· ${words}$`));
    }
  });

  it("gives away nothing of a private playlist, or a song in it, to a link's previewer", async () => {
    const owner = await createUser();
    const song = await callerFor(owner).songs.create({ source: SONG('Lalala', 'Bára') });
    const playlist = await callerFor(owner).playlists.create({
      name: 'Tajné',
      isPublic: false,
      songIds: [song.id],
    });
    for (const path of [url.playlist(playlist), url.playlistSong(playlist, 1)]) {
      const res = await request(app).get(path).expect(200);
      expect(res.text).toBe(shell);
    }
  });

  it("keeps the app's own preview for a link that leads nowhere, and for other pages", async () => {
    for (const path of [
      url.join('x'.repeat(22)),
      url.join('short'),
      '/song/999',
      '/song/nonsense',
      '/playlist/999-nic',
      '/',
      '/playlists',
      url.editSong(1),
    ]) {
      const res = await request(app).get(path).expect(200);
      expect(res.text).toBe(shell);
      expect(ogTag(res.text, 'og:title')).toBe('Zpěvňák');
    }
  });

  it('escapes what a person named, so it stays inside its attribute', async () => {
    const token = await invite('"><script>la</script> & co');
    const res = await request(app).get(url.join(token)).expect(200);
    expect(res.text).not.toContain('<script>la');
    expect(ogTag(res.text, 'og:title')).toBe(
      'Pozvánka do playlistu „&quot;&gt;&lt;script&gt;la&lt;/script&gt; &amp; co“',
    );
  });

  it('keeps a name with dollar signs as it is', async () => {
    const token = await invite('Hity za $1 a $2');
    const res = await request(app).get(url.join(token)).expect(200);
    expect(ogTag(res.text, 'og:title')).toBe('Pozvánka do playlistu „Hity za $1 a $2“');
  });

  it('refuses a shell without the tags, rather than share the wrong preview', () => {
    expect(() =>
      withLinkPreview('<html></html>', { title: 'a', description: 'b' }),
    ).toThrow('og:title');
  });
});
