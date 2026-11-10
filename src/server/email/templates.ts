import type { Locale, RejectionReason } from '#shared/validators/index.ts';
import { REJECTION_REASON_LABELS } from '#shared/rejectionReasons.ts';
import { url as paths } from '#shared/urls.ts';
import { env } from '../env.ts';
import type { Email } from './send.ts';

/** An app path as a full link, for an email. */
const link = (path: string) => `${env.APP_URL}${path}`;

export function verifyEmail(
  to: string,
  locale: Locale,
  token: string,
  next: string | null = null,
): Email {
  // `next` brings the reader back to where they signed up from (an invite, say).
  const url = link(paths.verifyEmail(token, next));
  return locale === 'cs'
    ? {
        to,
        subject: 'Potvrď svůj e-mail pro Zpěvňák',
        text: `Ahoj,\n\npro dokončení registrace potvrď svůj e-mail:\n\n${url}\n\nOdkaz platí 3 dny. Pokud ses neregistroval(a), tento e-mail ignoruj.\n\nZpěvňák`,
      }
    : {
        to,
        subject: 'Confirm your email for Zpěvňák',
        text: `Hi,\n\nconfirm your email to finish signing up:\n\n${url}\n\nThe link works for 3 days. If you didn't sign up, ignore this email.\n\nZpěvňák`,
      };
}

export function resetPassword(to: string, locale: Locale, token: string): Email {
  const url = link(paths.resetPassword(token));
  return locale === 'cs'
    ? {
        to,
        subject: 'Nové heslo pro Zpěvňák',
        text: `Ahoj,\n\nnové heslo si nastavíš tady:\n\n${url}\n\nOdkaz platí hodinu. Pokud jsi o nové heslo nežádal(a), tento e-mail ignoruj; tvoje heslo zůstává stejné.\n\nZpěvňák`,
      }
    : {
        to,
        subject: 'Reset your Zpěvňák password',
        text: `Hi,\n\nset a new password here:\n\n${url}\n\nThe link works for an hour. If you didn't ask for this, ignore this email; your password stays the same.\n\nZpěvňák`,
      };
}

/** Sent instead of a second account, so sign-up never reveals which emails are registered. */
export function alreadyRegistered(to: string, locale: Locale): Email {
  const url = link(paths.forgotPassword());
  return locale === 'cs'
    ? {
        to,
        subject: 'Na Zpěvňáku už účet máš',
        text: `Ahoj,\n\nněkdo (nejspíš ty) se chtěl zaregistrovat s tímto e-mailem, ale účet už existuje. Pokud jsi zapomněl(a) heslo, nastav si nové:\n\n${url}\n\nZpěvňák`,
      }
    : {
        to,
        subject: 'You already have a Zpěvňák account',
        text: `Hi,\n\nsomeone (probably you) tried to sign up with this email, but it already has an account. If you forgot your password, set a new one:\n\n${url}\n\nZpěvňák`,
      };
}

/** To a song's author, when an editor turns it down: why, and the way to fix it. */
export function songRejected(
  to: string,
  locale: Locale,
  song: { id: number; title: string; reason: RejectionReason; note: string | null },
): Email {
  const url = link(paths.editSong(song.id));
  // For "other", the note is the reason.
  const why =
    song.reason === 'other' && song.note
      ? song.note
      : `${REJECTION_REASON_LABELS[locale][song.reason]}${song.note ? `\n${song.note}` : ''}`;
  return locale === 'cs'
    ? {
        to,
        subject: `Písnička „${song.title}“ potřebuje opravit`,
        text: `Ahoj,\n\neditor se podíval na tvoji písničku „${song.title}“ a zatím ji neschválil.\n\n${why}\n\nOpravíš ji tady, po uložení půjde ke kontrole znovu:\n\n${url}\n\nZpěvňák`,
      }
    : {
        to,
        subject: `Your song “${song.title}” needs fixing`,
        text: `Hi,\n\nan editor looked at your song “${song.title}” and hasn't approved it yet.\n\n${why}\n\nFix it here; once saved, it goes back for review:\n\n${url}\n\nZpěvňák`,
      };
}
