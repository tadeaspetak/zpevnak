import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3100),
  DATABASE_URL: z.string().default('postgres://zpevnak:zpevnak@127.0.0.1:5434/zpevnak'),
  APP_URL: z.string().url().default('http://localhost:3100'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Zpěvňák <noreply@zpevnak.tadeaspetak.com>'),
});

// The email key is checked where the server starts (main.ts), not here: migrations load this
// too, and don't need it.
export const env = schema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';
