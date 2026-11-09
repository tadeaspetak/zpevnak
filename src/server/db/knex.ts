import knexFactory, { type Knex } from 'knex';
import pg from 'pg';
import { env } from '../env.ts';

// Ids are bigint, which pg returns as strings to be safe beyond 2^53. Ours never get there.
pg.types.setTypeParser(pg.types.builtins.INT8, Number);

export function createKnex(connectionString: string = env.DATABASE_URL): Knex {
  return knexFactory({
    client: 'pg',
    connection: connectionString,
    pool: { min: 0, max: 10 },
    migrations: {
      directory: new URL('../../../migrations', import.meta.url).pathname,
      loadExtensions: ['.ts'],
      tableName: 'knex_migrations',
    },
  });
}

export const db = createKnex();
