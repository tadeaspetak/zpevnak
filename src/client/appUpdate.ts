/**
 * New versions of the app. A device checks when the app starts, and the service worker
 * installs a new version and reloads onto it (vite-plugin-pwa, `autoUpdate`). A device that is
 * never closed (a tablet left open for days) would not check: the refresh button asks too
 * (D75), so tapping it before a gig brings both the songs and the app up to date.
 */
let registration: ServiceWorkerRegistration | undefined;

export function rememberRegistration(next: ServiceWorkerRegistration | undefined): void {
  registration = next;
}

/** Asks for a new version; when there is one, the page reloads onto it once it's installed. */
export async function checkForAppUpdate(): Promise<void> {
  try {
    await registration?.update();
  } catch {
    // Offline or the server is away: the next check will do.
  }
}
