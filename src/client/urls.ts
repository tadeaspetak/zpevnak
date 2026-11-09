import { slugify } from '#shared/text.ts';

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

/** Every path in the app. Build links with these, never by hand. */
export const url = {
  home: () => '/',
  song: (song: SongLink) => `/song/${ref(song.id, `${song.title} ${song.artist ?? ''}`)}`,
  editSong: (id: number) => `/song/${id}/edit`,
  newSong: () => '/new',
  playlists: () => '/playlists',
  playlist: (playlist: PlaylistLink) => `/playlist/${ref(playlist.id, playlist.name)}`,
  /** `position` counts from 1, as people do. */
  playlistSong: (playlist: PlaylistLink, position: number) =>
    `${url.playlist(playlist)}/${position}`,
  /** An invite link's path; `absolute` for sharing it outside the app. */
  join: (token: string) => `/join/${token}`,
  queue: () => '/queue',
  review: (id: number) => `/queue/${id}`,
  account: () => '/account',
  adminUsers: () => '/admin/users',
  logIn: (next?: string) => (next ? `/login?next=${encodeURIComponent(next)}` : '/login'),
  signUp: (next?: string) =>
    next ? `/signup?next=${encodeURIComponent(next)}` : '/signup',
  forgotPassword: () => '/forgot-password',
};

/** Route patterns, kept next to the builders above. */
export const routes = {
  home: '/',
  song: '/song/:songRef',
  editSong: '/song/:id/edit',
  newSong: '/new',
  playlists: '/playlists',
  playlist: '/playlist/:playlistRef',
  playlistSong: '/playlist/:playlistRef/:position',
  join: '/join/:token',
  queue: '/queue',
  review: '/queue/:id',
  account: '/account',
  adminUsers: '/admin/users',
  logIn: '/login',
  signUp: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verify: '/verify',
};

/** The id at the start of a reference: "12-andelska" → 12, "12" → 12. */
export function idFromRef(reference: string | undefined): number | null {
  const id = Number.parseInt(reference ?? '', 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}
