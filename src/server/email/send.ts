import { env, isProduction } from '../env.ts';

export type Email = {
  to: string;
  subject: string;
  text: string;
};

/** Emails sent while testing, newest last. Specs read links out of them. */
export const testOutbox: Email[] = [];

export async function sendEmail(email: Email): Promise<void> {
  if (env.NODE_ENV === 'test') {
    testOutbox.push(email);
    return;
  }
  if (!env.RESEND_API_KEY) {
    if (isProduction) {
      throw new Error('RESEND_API_KEY is not set');
    }
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
