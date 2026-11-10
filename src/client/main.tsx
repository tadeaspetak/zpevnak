import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App.tsx';
import { rememberRegistration } from './appUpdate.ts';
import { Providers } from './Providers.tsx';

// A new version installs in the background, and the page reloads onto it (appUpdate.ts, D75).
registerSW({
  immediate: true,
  onRegisteredSW: (_url, registration) => rememberRegistration(registration),
});

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Providers>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Providers>
  </StrictMode>,
);
