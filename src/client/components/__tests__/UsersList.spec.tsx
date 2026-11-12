import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '#tests/client/render.tsx';
import { UsersList } from '../UsersList.tsx';

/** The server answering every tRPC call in a batch with `data`, once `answer` is called. */
function stubServer(data: unknown) {
  let answer = () => {};
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (input: string) =>
        new Promise<Response>((resolve) => {
          const calls = new URL(input, 'http://localhost').pathname.split(',').length;
          answer = () =>
            resolve(
              Response.json(Array.from({ length: calls }, () => ({ result: { data } }))),
            );
        }),
    ),
  );
  return () => answer();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UsersList', () => {
  it('shows a loader while the users are on their way, and the users once they arrive', async () => {
    localStorage.setItem('zpevnak.locale', 'cs');
    const answer = stubServer([
      {
        id: 7,
        email: 'la@example.com',
        displayName: 'La La',
        role: 'user',
        emailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    renderApp(<UsersList />);
    expect(await screen.findByRole('status', { name: 'Načítám…' })).toBeTruthy();
    answer();
    expect(await screen.findByText('La La')).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Načítám…' })).toBeNull();
  });
});
