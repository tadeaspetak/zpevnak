/**
 * Small per-device preferences in localStorage. Every access is guarded: private windows and
 * blocked storage throw, and the app must work without them.
 */
type LocalKey =
  | 'locale'
  | 'session'
  | 'recentPlaylists'
  | 'recentSongs'
  | 'fontScale'
  | 'transpose'
  | 'showDiagrams'
  | 'showChords'
  | 'showColumns'
  | 'me'
  | 'colorScheme';

const PREFIX = 'zpevnak.';

export function readLocal(key: LocalKey): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeLocal(key: LocalKey, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(PREFIX + key);
    } else {
      localStorage.setItem(PREFIX + key, value);
    }
  } catch {
    // Storage is unavailable; the preference lasts until the page reloads.
  }
}

export function readLocalJson<T>(key: LocalKey, fallback: T): T {
  const raw = readLocal(key);
  if (raw === null) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeLocalJson(key: LocalKey, value: unknown): void {
  writeLocal(key, JSON.stringify(value));
}
