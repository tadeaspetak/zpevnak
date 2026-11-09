import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import { createApp } from './app.ts';
import { db } from './db/knex.ts';
import { env, isProduction } from './env.ts';

const root = new URL('../..', import.meta.url).pathname;
const app = createApp(db);

if (isProduction) {
  if (!env.RESEND_API_KEY) {
    throw new Error(
      'RESEND_API_KEY is required in production: nobody could verify an email',
    );
  }
  const dist = join(root, 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    throw new Error(`No client build in ${dist}: run "yarn build" first`);
  }
  // Hashed assets never change; the app shell and service worker must always be revalidated,
  // or a device keeps an old version forever.
  app.use(
    '/assets',
    express.static(join(dist, 'assets'), { immutable: true, maxAge: '1y', index: false }),
  );
  app.use(
    express.static(dist, {
      index: false,
      setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
    }),
  );
  app.get('/{*path}', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(join(dist, 'index.html'));
  });
} else {
  const { createServer } = await import('vite');
  // Its own HMR port, so it runs beside other projects' Vite servers; none under e2e tests.
  const vite = await createServer({
    server: {
      middlewareMode: true,
      hmr: process.env.VITE_HMR === 'off' ? false : { port: 24690 },
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(env.PORT, () => {
  console.log(`Zpěvňák listening on ${env.APP_URL} (port ${env.PORT})`);
});
