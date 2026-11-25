import { router } from '../trpc/trpc.ts';
import { authRouter } from './auth/index.ts';
import { notesRouter } from './notes/index.ts';
import { playlistsRouter } from './playlists/index.ts';
import { sharingRouter } from './sharing/index.ts';
import { songsRouter } from './songs/index.ts';
import { usersRouter } from './users/index.ts';

export const appRouter = router({
  auth: authRouter,
  songs: songsRouter,
  playlists: playlistsRouter,
  notes: notesRouter,
  sharing: sharingRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
