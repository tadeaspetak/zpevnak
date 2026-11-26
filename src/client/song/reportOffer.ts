import { url } from '#shared/urls.ts';

/** What "Nahlásit chybu" does in the song's ⋯ (D143), if it's there at all. */
export type ReportOffer = { onClick: () => void } | { to: string } | null;

/**
 * Who can't fix a song reports a mistake in it to its editors, with an account (D143): signed
 * in and confirmed, the report opens (`start`, there when `useSongNotes` lets them write one);
 * signed out, signing in leads back to it; not yet confirmed, they're told to confirm first.
 * Not offered to whoever may fix the song, nor on a private song, which no editor reviews.
 */
export function reportOffer({
  canFix,
  isPrivate,
  signedIn,
  start,
  path,
  unconfirmed,
}: {
  canFix: boolean;
  isPrivate: boolean;
  signedIn: boolean;
  start: (() => void) | undefined;
  /** The page the song is on, to come back to after signing in. */
  path: string;
  unconfirmed: () => void;
}): ReportOffer {
  if (canFix || isPrivate) {
    return null;
  }
  if (start) {
    return { onClick: start };
  }
  return signedIn ? { onClick: unconfirmed } : { to: url.logIn(url.reporting(path)) };
}
