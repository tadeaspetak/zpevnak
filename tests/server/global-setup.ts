import { createKnex } from '../../src/server/db/knex.ts';
import { TEST_DATABASE, TEST_DATABASE_URL } from './database.ts';

/** How many of the newest migrations to run again the way a deploy does: enough for a day's. */
const NEWEST_AS_A_DEPLOY = 3;

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
    // And the newest ones as a deploy runs them: undone one by one, then up again as one batch
    // on a database that already has the rest. A batch shares one transaction, which a run from
    // empty doesn't show (an enum value added in it can't be used in it, unless the type itself
    // is new there).
    for (let i = 0; i < NEWEST_AS_A_DEPLOY; i += 1) {
      await test.migrate.down();
    }
    await test.migrate.latest();
  } finally {
    await test.destroy();
  }
}
