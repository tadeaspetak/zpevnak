import { TRPCError } from '@trpc/server';
import express, { type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { idFromRef, routes } from '#shared/urls.ts';
import { inviteTokenSchema } from '#shared/validators/index.ts';
import { loadInvitePreview } from './sharing/invite.ts';
import { loadVisiblePlaylist, type PlaylistRecord } from './playlists/load.ts';
import { loadSong } from './songs/load.ts';

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

/*
 * The previews are in Czech: the language of the app's shell, and a previewer brings no reader
 * to pick another for. A previewer is signed out, so each page is loaded as nobody, through the
 * app's own rules: what it may not see (a private playlist) keeps the app's own preview, as does
 * a link that leads nowhere.
 */

/** Null for what nobody signed out may see, or what isn't there; anything else is thrown on. */
async function unlessNotFound<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof TRPCError && error.code === 'NOT_FOUND') {
      return null;
    }
    throw error;
  }
}

const songCount = (count: number) => {
  const form = new Intl.PluralRules('cs').select(count);
  const noun = form === 'one' ? 'písnička' : form === 'few' ? 'písničky' : 'písniček';
  return `${count}\u00a0${noun}`;
};

const songTitle = (song: { title: string; artist: string | null }) =>
  song.artist ? `${song.title} · ${song.artist}` : song.title;

async function invitePreview(db: Knex, token: string): Promise<LinkPreview | null> {
  if (!inviteTokenSchema.safeParse(token).success) {
    return null;
  }
  const invite = await loadInvitePreview(db, token);
  if (!invite) {
    return null;
  }
  return invite.kind === 'playlist'
    ? {
        title: `Pozvánka do playlistu „${invite.name}“`,
        description: `${invite.ownerName} tě zve, ať se přidáš k playlistu „${invite.name}“ na Zpěvňáku.`,
      }
    : {
        title: `Pozvánka k písničce „${invite.name}“`,
        description: `${invite.ownerName} s tebou sdílí písničku „${invite.name}“ na Zpěvňáku.`,
      };
}

/** Any song: anyone may open one by its link, a rejected one too (D77). */
async function songPreview(db: Knex, songRef: string): Promise<LinkPreview | null> {
  const id = idFromRef(songRef);
  const song = id ? await unlessNotFound(() => loadSong(db, id, null)) : null;
  if (!song) {
    return null;
  }
  return { title: songTitle(song), description: 'Text a akordy na Zpěvňáku.' };
}

/** A public playlist, as nobody signed in sees it: a private one is its own people's business. */
async function publicPlaylist(db: Knex, playlistRef: string) {
  const id = idFromRef(playlistRef);
  return id ? unlessNotFound(() => loadVisiblePlaylist(db, id, null)) : null;
}

const playlistPreview = (playlist: PlaylistRecord): LinkPreview => ({
  title: playlist.name,
  // Names stand alone, never after a preposition: Czech would decline them ("od Báry").
  description: `${playlist.ownerName} · playlist na Zpěvňáku · ${songCount(playlist.songIds.length)}`,
});

/** A song inside a public playlist; a place with no song in it is the playlist's preview. */
async function playlistSongPreview(
  db: Knex,
  playlistRef: string,
  position: string,
): Promise<LinkPreview | null> {
  const playlist = await publicPlaylist(db, playlistRef);
  if (!playlist) {
    return null;
  }
  const index = Number(position);
  const songId = Number.isInteger(index) ? playlist.songIds[index - 1] : undefined;
  const song = songId ? await unlessNotFound(() => loadSong(db, songId, null)) : null;
  if (!song) {
    return playlistPreview(playlist);
  }
  return {
    title: songTitle(song),
    description: `${index}. písnička z playlistu „${playlist.name}“ na Zpěvňáku.`,
  };
}

/**
 * Every page of the app: the shell, from `shell(url)` (built in production, Vite's in
 * development), with the link preview of the page where it has its own.
 */
export function pages(db: Knex, shell: (url: string) => Promise<string>) {
  const router = express.Router();
  const page =
    (preview: (params: Record<string, string>) => Promise<LinkPreview | null>) =>
    async (req: Request, res: Response) => {
      const html = await shell(req.originalUrl);
      // A preview is a nicety: whatever stops it (the database away, an id out of range), the
      // page still opens, as it did before there were previews.
      const found = await preview(req.params as Record<string, string>).catch(
        (error: unknown) => {
          console.error(`No link preview for ${req.originalUrl}:`, error);
          return null;
        },
      );
      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(found ? withLinkPreview(html, found) : html);
    };
  router.get(
    routes.join,
    page((p) => invitePreview(db, p.token as string)),
  );
  router.get(
    routes.song,
    page((p) => songPreview(db, p.songRef as string)),
  );
  router.get(
    routes.playlist,
    page(async (p) => {
      const playlist = await publicPlaylist(db, p.playlistRef as string);
      return playlist ? playlistPreview(playlist) : null;
    }),
  );
  router.get(
    routes.playlistSong,
    page((p) => playlistSongPreview(db, p.playlistRef as string, p.position as string)),
  );
  router.get(
    '/{*path}',
    page(async () => null),
  );
  return router;
}
