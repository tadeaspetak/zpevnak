import { createKnex } from '../../src/server/db/knex.ts';
import { TEST_DATABASE, TEST_DATABASE_URL } from './database.ts';

/**
 * Creates the test database if it is missing, and brings it to the latest migration, by way of
 * undoing them all.
 */
export default async function setup() {
  const admin = createKnex(TEST_DATABASE_URL.replace(`/${TEST_DATABASE}`, '/postgres'));
  try {
    const { rows } = await admin.raw(
      /* sql */ `SELECT 1 FROM pg_database WHERE datname = ?`,
      [TEST_DATABASE],
    );
    if (rows.length === 0) {
      await admin.raw(`CREATE DATABASE ${TEST_DATABASE}`);
    }
  } finally {
    await admin.destroy();
  }
  const test = createKnex(TEST_DATABASE_URL);
  try {
    // There and back and there again: every `down` runs too, so a rollback in production
    // would work (the enum rebuild in 202611100005 especially).
    await test.migrate.latest();
    await test.migrate.rollback(undefined, true);
    await test.migrate.latest();
  } finally {
    await test.destroy();
  }
}
