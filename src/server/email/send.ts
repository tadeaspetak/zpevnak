import { env } from '../env.ts';

export type Email = {
  to: string;
  subject: string;
  text: string;
};

/** Emails sent while testing, newest last. Specs read links out of them. */
export const testOutbox: Email[] = [];

/**
 * Sends without holding up the answer, for mail the request doesn't depend on. A failure is
 * logged: what the person did still stands, and they can ask again (resend a verification,
 * request another reset). Not waiting also keeps "is there an account?" out of the timing.
 */
export function sendEmailInBackground(email: Email, what: string): void {
  sendEmail(email).catch((error: unknown) => {
    console.error(`Email (${what}) to ${email.to} failed:`, error);
  });
}

export async function sendEmail(email: Email): Promise<void> {
  if (env.NODE_ENV === 'test') {
    testOutbox.push(email);
    return;
  }
  if (!env.RESEND_API_KEY) {
    // Production refuses to start without it (main.ts); here we are in development.
    console.log(`\n✉️  To: ${email.to}\n   Subject: ${email.subject}\n\n${email.text}\n`);
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      text: email.text,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Resend refused the email: ${response.status} ${await response.text()}`,
    );
  }
}
