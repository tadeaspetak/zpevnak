import type { AddressInfo } from 'node:net';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import type { AppRouter } from '../routers/index.ts';
import { db, useCleanDatabase } from '#tests/server/helpers.ts';

useCleanDatabase();

// The real client against a listening server: what a person's browser would get.
const server = createApp(db, { limitAuth: true }).listen(0);
const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/trpc`,
    }),
  ],
});
const logIn = () =>
  client.auth.logIn.mutate({ email: 'nobody@example.com', password: 'x'.repeat(12) });

beforeAll(async () => {
  for (let i = 0; i < 30; i++) {
    await expect(logIn()).rejects.toThrow('INVALID_CREDENTIALS');
  }
});
afterAll(() => {
  server.close();
});

describe('the sign-in rate limit', () => {
  it('refuses the 31st attempt with a code the client can translate', async () => {
    await expect(logIn()).rejects.toThrow('TOO_MANY_REQUESTS');
  });

  it('refuses a limited call batched with others, and each of them says why', async () => {
    // Two mutations in one tick share a request; a query would go in its own.
    const results = await Promise.allSettled([logIn(), client.auth.logOut.mutate()]);
    expect(
      results.map((r) => r.status === 'rejected' && (r.reason as Error).message),
    ).toEqual(['TOO_MANY_REQUESTS', 'TOO_MANY_REQUESTS']);
  });

  it('leaves everything else alone', async () => {
    await expect(client.songs.sync.query({ since: null })).resolves.toMatchObject({
      songs: [],
    });
  });
});
