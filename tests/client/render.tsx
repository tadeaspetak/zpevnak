import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, parsePath } from 'react-router';
import { Providers } from '#client/Providers.tsx';

/**
 * Renders `ui` the way the app does: inside its providers (theme, translations, queries; Czech
 * unless the test sets another locale), with a router at `path`, arrived at with `state` (what a
 * link carries).
 */
export function renderApp(
  ui: ReactNode,
  { path = '/', state }: { path?: string; state?: unknown } = {},
) {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[{ ...parsePath(path), state }]}>{ui}</MemoryRouter>
    </Providers>,
  );
}
