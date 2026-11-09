import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App.tsx';
import { rememberRegistration } from './appUpdate.ts';
import { I18nProvider } from './i18n/index.tsx';
import { cssVariablesResolver, theme } from './theme.ts';
import { trpc, trpcReactClient } from './trpc.ts';

// A new version installs in the background and takes over on the next visit.
registerSW({
  immediate: true,
  onRegisteredSW: (_url, registration) => rememberRegistration(registration),
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <trpc.Provider client={trpcReactClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider
          theme={theme}
          cssVariablesResolver={cssVariablesResolver}
          defaultColorScheme="auto"
        >
          <Notifications position="top-center" />
          <I18nProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </I18nProvider>
        </MantineProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
