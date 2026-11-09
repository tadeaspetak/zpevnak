import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './tests/server/database.ts';

export default defineConfig({
  test: {
    env: { TZ: 'UTC' },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/shared/**/*.spec.ts', '.claude/hooks/**/*.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/server/**/*.spec.ts', 'migrations/**/*.spec.ts'],
          globalSetup: ['tests/server/global-setup.ts'],
          env: {
            NODE_ENV: 'test',
            DATABASE_URL: TEST_DATABASE_URL,
          },
          // Specs share one test database; running files one at a time keeps them apart.
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['src/client/**/*.spec.{ts,tsx}'],
          setupFiles: ['tests/client/setup.ts'],
        },
      },
    ],
  },
});
