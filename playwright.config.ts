import { defineConfig, devices } from '@playwright/test';

/** End-to-end: the one happy path through the app, on a phone. Logic is proven in Vitest. */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3101',
    trace: 'retain-on-failure',
    ...devices['Pixel 7'],
  },
  webServer: {
    command: 'node tests/e2e/server.ts',
    url: 'http://localhost:3101/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
