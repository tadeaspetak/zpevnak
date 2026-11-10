import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { Providers } from '#client/Providers.tsx';

/**
 * Renders `ui` the way the app does: inside its providers (theme, translations, queries; Czech
 * unless the test sets another locale), with a router at `path`.
 */
export function renderApp(ui: ReactNode, { path = '/' }: { path?: string } = {}) {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </Providers>,
  );
}
