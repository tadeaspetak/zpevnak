import { slugify } from '#shared/text.ts';

/** Every path in the app. Build links with these, never by hand. */
export const url = {
  home: () => '/',
  song: (song: { id: number; title: string; artist: string | null }) =>
    `/s/${song.id}-${slugify(`${song.title} ${song.artist ?? ''}`)}`,
  editSong: (id: number) => `/s/${id}/edit`,
  newSong: () => '/new',
  playlists: () => '/playlists',
  playlist: (id: number) => `/p/${id}`,
  /** `position` counts from 1, as people do. */
  playlistSong: (id: number, position: number) => `/p/${id}/${position}`,
  queue: () => '/queue',
  review: (id: number) => `/queue/${id}`,
  account: () => '/account',
  adminUsers: () => '/admin/users',
  logIn: (next?: string) => (next ? `/login?next=${encodeURIComponent(next)}` : '/login'),
  signUp: () => '/signup',
  forgotPassword: () => '/forgot-password',
};

/** Route patterns, kept next to the builders above. */
export const routes = {
  home: '/',
  song: '/s/:songRef',
  editSong: '/s/:id/edit',
  newSong: '/new',
  playlists: '/playlists',
  playlist: '/p/:id',
  playlistSong: '/p/:id/:position',
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

/** The id at the start of a song reference: "12-andelska" → 12. */
export function songIdFromRef(ref: string | undefined): number | null {
  const id = Number.parseInt(ref ?? '', 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}
