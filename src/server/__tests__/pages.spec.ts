import { readFileSync } from 'node:fs';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { url } from '#shared/urls.ts';
import { pages, withLinkPreview } from '../pages.ts';
import { callerFor, createUser, db, useCleanDatabase } from '#tests/server/helpers.ts';

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

  it("keeps the app's own preview for an invite that leads nowhere, and for other pages", async () => {
    for (const path of [url.join('x'.repeat(22)), url.join('short'), '/', '/playlists']) {
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
