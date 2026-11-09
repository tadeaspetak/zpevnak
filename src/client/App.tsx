import { useEffect, useMemo } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { SearchOverlay } from './components/SearchOverlay.tsx';
import { syncCatalog } from './data/catalog.ts';
import { openSearch } from './data/omnibox.ts';
import { useKeys } from './hooks/useKeys.ts';
import { useMe } from './hooks/useMe.ts';
import { AccountPage } from './pages/AccountPage.tsx';
import { AdminUsersPage } from './pages/AdminUsersPage.tsx';
import {
  ForgotPasswordPage,
  LogInPage,
  ResetPasswordPage,
  SignUpPage,
  VerifyEmailPage,
} from './pages/AuthPages.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { PlaylistPage } from './pages/PlaylistPage.tsx';
import { PlaylistsPage } from './pages/PlaylistsPage.tsx';
import { QueuePage } from './pages/QueuePage.tsx';
import { ReviewPage } from './pages/ReviewPage.tsx';
import { EditSongPage, NewSongPage } from './pages/SongEditPage.tsx';
import { PlaylistSongPage, SongPage } from './pages/SongPage.tsx';
import { routes, url } from './urls.ts';

const SYNC_EVERY_MS = 5 * 60_000;

/** Keeps the device's catalog in step: on start, on sign-in/out, on return, and every 5 min. */
function useCatalogSync() {
  const { me, known } = useMe();
  const viewer = me?.id ?? null;
  useEffect(() => {
    if (!known) {
      return;
    }
    const sync = () => {
      if (navigator.onLine) {
        void syncCatalog(viewer);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        sync();
      }
    };
    sync();
    const timer = window.setInterval(sync, SYNC_EVERY_MS);
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [viewer, known]);
}

export function App() {
  useCatalogSync();
  const { pathname } = useLocation();
  // "/" searches from anywhere; on the overview, its own search box takes it instead.
  useKeys(
    useMemo(() => (pathname === url.home() ? {} : { '/': openSearch }), [pathname]),
  );
  return (
    <>
      <SearchOverlay />
      <Routes>
        <Route path={routes.home} element={<HomePage />} />
        <Route path={routes.editSong} element={<EditSongPage />} />
        <Route path={routes.song} element={<SongPage />} />
        <Route path={routes.newSong} element={<NewSongPage />} />
        <Route path={routes.playlists} element={<PlaylistsPage />} />
        <Route path={routes.playlist} element={<PlaylistPage />} />
        <Route path={routes.playlistSong} element={<PlaylistSongPage />} />
        <Route path={routes.queue} element={<QueuePage />} />
        <Route path={routes.review} element={<ReviewPage />} />
        <Route path={routes.account} element={<AccountPage />} />
        <Route path={routes.adminUsers} element={<AdminUsersPage />} />
        <Route path={routes.logIn} element={<LogInPage />} />
        <Route path={routes.signUp} element={<SignUpPage />} />
        <Route path={routes.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={routes.resetPassword} element={<ResetPasswordPage />} />
        <Route path={routes.verify} element={<VerifyEmailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
