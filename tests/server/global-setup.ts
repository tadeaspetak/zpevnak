import { createKnex } from '../../src/server/db/knex.ts';
import { TEST_DATABASE, TEST_DATABASE_URL } from './database.ts';

/** Creates the test database if it is missing, and brings it to the latest migration. */
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
    await test.migrate.latest();
  } finally {
    await test.destroy();
  }
}
