import express, { type Response } from 'express';
import type { Knex } from 'knex';
import { routes } from '#shared/urls.ts';
import { inviteTokenSchema } from '#shared/validators/index.ts';
import { loadInvitePreview } from './playlists/invite.ts';

/** How a link to a page reads where it is shared (a chat, a post): `og:title`, `og:description`. */
export type LinkPreview = { title: string; description: string };

const escapeAttribute = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

/**
 * The app shell with a page's own link preview in place of the app's. Link previewers don't run
 * the app, so what they show is only what this HTML says. The page title stays the app's: the
 * shell keeps it as the reader moves on to other pages.
 */
export function withLinkPreview(html: string, preview: LinkPreview): string {
  const set = (html: string, property: string, value: string) => {
    // Any whitespace between the attributes: a formatter may wrap a long tag.
    const tag = new RegExp(`(<meta\\s+property="${property}"\\s+content=")[^"]*(")`);
    if (!tag.test(html)) {
      throw new Error(`index.html has no ${property} to replace`);
    }
    // A function, so a `$&` someone typed into a name stays text, not a replacement pattern.
    return html.replace(
      tag,
      (_tag, start: string, end: string) => start + escapeAttribute(value) + end,
    );
  };
  return set(set(html, 'og:title', preview.title), 'og:description', preview.description);
}

/**
 * An invite, named in Czech: the language of the app's shell, and the previewer sends no reader
 * to pick another for. A link that leads nowhere keeps the app's own preview.
 */
async function invitePreview(db: Knex, token: string): Promise<LinkPreview | null> {
  if (!inviteTokenSchema.safeParse(token).success) {
    return null;
  }
  const invite = await loadInvitePreview(db, token);
  if (!invite) {
    return null;
  }
  return {
    title: `Pozvánka do playlistu „${invite.name}“`,
    description: `${invite.ownerName} tě zve, ať se přidáš k playlistu „${invite.name}“ na Zpěvňáku.`,
  };
}

/**
 * Every page of the app: the shell, from `shell(url)` (built in production, Vite's in
 * development), with the link preview of the page where it has its own.
 */
export function pages(db: Knex, shell: (url: string) => Promise<string>) {
  const router = express.Router();
  const send = (res: Response, html: string) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(html);
  };
  router.get(routes.join, async (req, res) => {
    const html = await shell(req.originalUrl);
    const preview = await invitePreview(db, req.params.token as string);
    send(res, preview ? withLinkPreview(html, preview) : html);
  });
  router.get('/{*path}', async (req, res) => {
    send(res, await shell(req.originalUrl));
  });
  return router;
}
