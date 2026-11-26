import { url } from '#shared/urls.ts';

/** What "Nahlásit chybu" does in the song's ⋯ (D143), if it's there at all. */
export type ReportOffer = { onClick: () => void } | { to: string } | null;

/**
 * Anyone reports a mistake in a song to its editors, with an account (D143), an editor too, for
 * whoever gets to it: signed in and confirmed, the report opens (`start`, there when
 * `useSongNotes` lets them write one); signed out, signing in leads back to it; not yet
 * confirmed, they're told to confirm first. Not on a private song, which no editor reviews.
 */
export function reportOffer({
  isPrivate,
  signedIn,
  start,
  path,
  unconfirmed,
}: {
  isPrivate: boolean;
  signedIn: boolean;
  start: (() => void) | undefined;
  /** The page the song is on, to come back to after signing in. */
  path: string;
  unconfirmed: () => void;
}): ReportOffer {
  if (isPrivate) {
    return null;
  }
  if (start) {
    return { onClick: start };
  }
  return signedIn ? { onClick: unconfirmed } : { to: url.logIn(url.reporting(path)) };
}
