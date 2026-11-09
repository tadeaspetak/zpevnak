import { router } from '../trpc/trpc.ts';
import { authRouter } from './auth/index.ts';
import { playlistsRouter } from './playlists/index.ts';
import { songsRouter } from './songs/index.ts';
import { usersRouter } from './users/index.ts';

export const appRouter = router({
  auth: authRouter,
  songs: songsRouter,
  playlists: playlistsRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
