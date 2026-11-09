import { db } from './knex.ts';

const command = process.argv[2];

try {
  if (command === 'latest') {
    const [batch, files] = await db.migrate.latest();
    console.log(
      files.length ? `Batch ${batch}: ${files.join(', ')}` : 'Already up to date',
    );
  } else if (command === 'rollback') {
    const [batch, files] = await db.migrate.rollback();
    console.log(
      files.length
        ? `Rolled back batch ${batch}: ${files.join(', ')}`
        : 'Nothing to roll back',
    );
  } else {
    console.error('Usage: node src/server/db/migrate.ts latest|rollback');
    process.exitCode = 1;
  }
} finally {
  await db.destroy();
}
