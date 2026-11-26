import { tagKey } from './chordpro/tags.ts';
import { slugify } from './text.ts';

/**
 * A reference in a path: the id, which is what the app looks up, then a readable slug, which is
 * for people ("2-lajla-tov-dobrou-noc"). The slug needn't be unique and may go stale after a
 * rename; the page then puts the current one in the address (`useCanonicalPath`).
 */
function ref(id: number, text: string): string {
  const slug = slugify(text);
  return slug ? `${id}-${slug}` : String(id);
}

type SongLink = { id: number; title: string; artist: string | null };
type PlaylistLink = { id: number; name: string };

/** The query a song page opens "Nahlásit chybu" by (`url.reporting`). */
export const REPORT_PARAM = 'report';

/**
 * Every path in the app. Build links with these, never by hand: the client for its pages, the
 * server for the links in its emails.
 */
export const url = {
  home: () => '/',
  song: (song: SongLink) => `/song/${ref(song.id, `${song.title} ${song.artist ?? ''}`)}`,
  editSong: (id: number) => `/song/${id}/edit`,
  /** A song not found by a search: its title to start from, and the playlist it is for. */
  newSong: (from?: { title?: string; playlistId?: number }) => {
    const params = new URLSearchParams();
    if (from?.title?.trim()) {
      params.set('title', from.title.trim());
    }
    if (from?.playlistId) {
      params.set('playlist', String(from.playlistId));
    }
    const query = params.toString();
    return query ? `/new?${query}` : '/new';
  },
  /** Every song with the tag, however each spells it. */
  tag: (tag: string) => `/tag/${encodeURIComponent(tagKey(tag))}`,
  playlists: () => '/playlists',
  playlist: (playlist: PlaylistLink) => `/playlist/${ref(playlist.id, playlist.name)}`,
  /** `position` counts from 1, as people do. */
  playlistSong: (playlist: PlaylistLink, position: number) =>
    `${url.playlist(playlist)}/${position}`,
  /** An invite link's path; `absolute` for sharing it outside the app. */
  join: (token: string) => `/join/${token}`,
  /** The editors' worklist: songs waiting (the default), rejected, or reports (D143). */
  queue: (tab?: 'rejected' | 'reports') => (tab ? `/queue?status=${tab}` : '/queue'),
  review: (id: number) => `/queue/${id}`,
  /** One's notes on songs (D135), a tab of the account (D139): all, or the TODOs open or done. */
  notes: (filter?: 'todo' | 'done') =>
    `${url.account('notes')}${filter ? `&filter=${filter}` : ''}`,
  /** `notes`: one's notes (D139); `users`: the admin's tab of everyone's accounts. */
  account: (tab?: 'notes' | 'users') => (tab ? `/account?tab=${tab}` : '/account'),
  /** The song page at `path`, with the report dialog open (D143): where signing in leads back. */
  reporting: (path: string) => `${path}?${REPORT_PARAM}=1`,
  logIn: (next?: string) => (next ? `/login?next=${encodeURIComponent(next)}` : '/login'),
  signUp: (next?: string) =>
    next ? `/signup?next=${encodeURIComponent(next)}` : '/signup',
  forgotPassword: () => '/forgot-password',
  /** The emailed links: confirming an email (then on to `next`), and setting a new password. */
  verifyEmail: (token: string, next?: string | null) =>
    `/verify?token=${encodeURIComponent(token)}${next ? `&next=${encodeURIComponent(next)}` : ''}`,
  resetPassword: (token: string) => `/reset-password?token=${encodeURIComponent(token)}`,
};

/**
 * The app's one address in production (D140). Emails link here: `scripts/deploy.sh` reads it
 * into `APP_URL`.
 * @public
 */
export const PRODUCTION_ORIGIN = 'https://zpevnak.cz';

/** Where the app was, or another spelling of where it is: each sends people on (D140). */
const MOVED_HOSTS = new Set(['zpevnak.tadeaspetak.com', 'www.zpevnak.cz']);

/**
 * The same page at the one address, for a page opened on a host the app has moved from; null
 * anywhere else. `path` keeps the query and the hash, so a link in an old email still lands.
 */
export function movedTo(host: string, path: string): string | null {
  return MOVED_HOSTS.has(host.toLowerCase()) ? `${PRODUCTION_ORIGIN}${path}` : null;
}

/** Route patterns, kept next to the builders above. */
export const routes = {
  home: '/',
  song: '/song/:songRef',
  editSong: '/song/:id/edit',
  newSong: '/new',
  tag: '/tag/:tagKey',
  playlists: '/playlists',
  playlist: '/playlist/:playlistRef',
  playlistSong: '/playlist/:playlistRef/:position',
  join: '/join/:token',
  queue: '/queue',
  review: '/queue/:id',
  account: '/account',
  /** Where Moje poznámky was its own page; it redirects to the account's tab (D139). */
  notes: '/notes',
  adminUsers: '/admin/users',
  logIn: '/login',
  signUp: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verify: '/verify',
};

/**
 * The id at the start of a reference: "12-andelska" → 12, "12" → 12. Null for anything no id can
 * be, too long a number included (it would come out rounded, and past the database's range).
 */
export function idFromRef(reference: string | undefined): number | null {
  const id = Number.parseInt(reference ?? '', 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
