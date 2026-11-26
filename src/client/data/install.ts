import { useSyncExternalStore } from 'react';

/**
 * Adding Zpěvňák to the home screen (D141): offered on a phone or tablet whose browser can do
 * it, while the app isn't already open from there.
 *
 * - `prompt`: the browser offers to install it itself (Chrome, Edge, Samsung on Android): one
 *   tap opens its own dialog.
 * - `ios`: an iPhone or iPad, where a page can't start it: the steps, Share → Přidat na plochu.
 * - null: nothing to offer. A laptop (its pointer is a mouse, a touchscreen one's too), the app
 *   already installed and open, or a browser that says neither (Firefox: left out on purpose,
 *   its menu says it differently from one version to the next).
 */
export type InstallWay = 'prompt' | 'ios' | null;

export function installWay(device: {
  standalone: boolean;
  touch: boolean;
  canPrompt: boolean;
  ios: boolean;
}): InstallWay {
  if (device.standalone || !device.touch) {
    return null;
  }
  if (device.canPrompt) {
    return 'prompt';
  }
  return device.ios ? 'ios' : null;
}

/** An iPhone, or an iPad, which says it's a Mac but has a touchscreen. */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return (
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  );
}

/** Chrome's own event (not in TypeScript's DOM types): its dialog, kept to open on a tap. */
type InstallPromptEvent = Event & { prompt: () => Promise<void> };

let offer: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

// Listened for as the module loads: the browser offers once, early, maybe before React renders.
window.addEventListener('beforeinstallprompt', (event) => {
  // The browser's own banner stays away; ours says what it gives.
  event.preventDefault();
  offer = event as InstallPromptEvent;
  changed();
});
window.addEventListener('appinstalled', () => {
  offer = null;
  changed();
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** How this device adds the app to its home screen, and doing it where a tap can. */
export function useInstall() {
  const canPrompt = useSyncExternalStore(subscribe, () => offer !== null);
  const way = installWay({
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    touch: window.matchMedia('(pointer: coarse)').matches,
    canPrompt,
    ios: isIos(navigator.userAgent, navigator.maxTouchPoints),
  });
  const prompt = async () => {
    const shown = offer;
    if (!shown) {
      return;
    }
    // An offer opens its dialog once; turned down, the browser may offer again later.
    offer = null;
    changed();
    await shown.prompt();
  };
  return { way, prompt };
}
