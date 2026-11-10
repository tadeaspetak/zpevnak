import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { I18nProvider } from './i18n/index.tsx';
import { cssVariablesResolver, theme } from './theme.ts';
import { trpc, trpcReactClient } from './trpc.ts';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

/** Everything the app runs inside, in an order that matters (see the comments). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcReactClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider
          theme={theme}
          cssVariablesResolver={cssVariablesResolver}
          defaultColorScheme="auto"
        >
          <I18nProvider>
            {/* Inside the translations: a toast may hold a component that reads them. */}
            <Notifications position="top-center" />
            {/* Inside the translations too, so a crash is explained in the reader's language. */}
            <ErrorBoundary>{children}</ErrorBoundary>
          </I18nProvider>
        </MantineProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
