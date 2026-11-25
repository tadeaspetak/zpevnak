import { MantineProvider, Modal, mergeThemeOverrides, Notification } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useMemo } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { I18nProvider, useI18n } from './i18n/index.tsx';
import { cssVariablesResolver, theme } from './theme.ts';
import classes from './Providers.module.css';
import { trpc, trpcReactClient } from './trpc.ts';

// React Query takes itself for online until an `offline` event says otherwise, so in an app
// opened with no signal (at the gig) a playlist edit failed and was lost instead of waiting for
// the connection, as the offline hint promises. It starts from what the browser knows.
onlineManager.setOnline(navigator.onLine);

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

/** Everything the app runs inside, in an order that matters (see the comments). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcReactClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {/* Outside the theme: the theme's labels are words too. */}
        <I18nProvider>
          <Themed>
            {/* Inside the translations: a toast may hold a component that reads them. */}
            {/* Below the header (Providers.module.css). */}
            <Notifications
              position="top-center"
              classNames={{ root: classes.notifications }}
            />
            {/* Inside the translations too, so a crash is explained in the reader's language. */}
            <ErrorBoundary>{children}</ErrorBoundary>
          </Themed>
        </I18nProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

/**
 * The theme, with the words Mantine's own controls need in the reader's language: every
 * dialog's and toast's close button is named, once, here.
 */
function Themed({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const close = t('common.close');
  const themed = useMemo(
    () =>
      mergeThemeOverrides(theme, {
        components: {
          Modal: Modal.extend({
            defaultProps: { closeButtonProps: { 'aria-label': close } },
          }),
          Notification: Notification.extend({
            defaultProps: { closeButtonProps: { 'aria-label': close } },
          }),
        },
      }),
    [close],
  );
  return (
    <MantineProvider
      theme={themed}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="auto"
    >
      {children}
    </MantineProvider>
  );
}
