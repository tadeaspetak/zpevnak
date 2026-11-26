import { useSyncExternalStore } from 'react';

/**
 * Adding Zpěvňák to the home screen (D141): offered on a phone or tablet whose browser can do
 * it, while the app isn't already open from there.
 *
 * - `prompt`: the browser offers to install it itself (Chrome, Edge, Samsung on Android): one
 *   tap opens its own dialog.
 * - `ios`: an iPhone or iPad, where a page can't start it: the steps, Share → Přidat na plochu.
 * - `firefox`: Firefox on Android, which can't either: the steps through its menu (D142).
 * - null: nothing to offer. A laptop (its pointer is a mouse, a touchscreen one's too), the app
 *   already installed and open, or a browser that says none of these.
 */
export type InstallWay = 'prompt' | 'ios' | 'firefox' | null;

export function installWay(device: {
  standalone: boolean;
  touch: boolean;
  canPrompt: boolean;
  ios: boolean;
  firefoxAndroid: boolean;
}): InstallWay {
  if (device.standalone || !device.touch) {
    return null;
  }
  if (device.canPrompt) {
    return 'prompt';
  }
  if (device.ios) {
    return 'ios';
  }
  return device.firefoxAndroid ? 'firefox' : null;
}

/** An iPhone, or an iPad, which says it's a Mac but has a touchscreen. */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return (
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  );
}

/** Firefox on an Android phone or tablet (Firefox on an iPhone is an iPhone's Safari inside). */
export function isFirefoxAndroid(userAgent: string): boolean {
  return /Android/.test(userAgent) && /Firefox\//.test(userAgent);
}

/** Chrome's own event (not in TypeScript's DOM types): its dialog, kept to open on a tap. */
type InstallPromptEvent = Event & { prompt: () => Promise<void> };

let offer: InstallPromptEvent | null = null;
// The steps' dialog, one for the app: opened from a button that may be in the settings'
// popover, which closes as it opens (a dialog inside it would sit under it, and go with it).
let stepsOpen = false;
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

export function setInstallSteps(open: boolean) {
  stepsOpen = open;
  changed();
}

export function useInstallSteps(): boolean {
  return useSyncExternalStore(subscribe, () => stepsOpen);
}

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
    firefoxAndroid: isFirefoxAndroid(navigator.userAgent),
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
