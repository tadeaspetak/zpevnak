/**
 * The server end-to-end tests run against: its own database (zpevnak_e2e), wiped, migrated and
 * seeded on every start, on port 3101, so it never touches development data or the dev server.
 * App code runs in child processes with their own environment: the app reads its environment
 * once, on import.
 */
import { execFileSync, spawn } from 'node:child_process';
import pg from 'pg';

const E2E_DATABASE = 'zpevnak_e2e';
const base = process.env.E2E_DATABASE_URL ?? 'postgres://zpevnak:zpevnak@127.0.0.1:5434';

const admin = new pg.Client({ connectionString: `${base}/postgres` });
await admin.connect();
try {
  await admin.query(`DROP DATABASE IF EXISTS ${E2E_DATABASE} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${E2E_DATABASE}`);
} finally {
  await admin.end();
}

const env = {
  ...process.env,
  DATABASE_URL: `${base}/${E2E_DATABASE}`,
  PORT: '3101',
  APP_URL: 'http://localhost:3101',
  // No live reload: its port would collide with a dev server, and tests don't need it.
  VITE_HMR: 'off',
};
execFileSync('node', ['src/server/db/migrate.ts', 'latest'], { env, stdio: 'inherit' });
execFileSync('node', ['src/server/db/seed.ts'], { env, stdio: 'inherit' });

const server = spawn('node', ['src/server/main.ts'], { env, stdio: 'inherit' });
const stop = () => server.kill();
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
server.on('exit', (code) => process.exit(code ?? 0));
