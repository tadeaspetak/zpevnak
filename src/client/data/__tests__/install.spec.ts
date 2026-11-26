import { describe, expect, it } from 'vitest';
import { installWay, isFirefoxAndroid, isIos } from '../install.ts';

const phone = {
  standalone: false,
  touch: true,
  canPrompt: false,
  ios: false,
  firefoxAndroid: false,
};

describe('installWay (D141)', () => {
  it('opens the browser’s own dialog where it offers one, on a phone or tablet', () => {
    expect(installWay({ ...phone, canPrompt: true })).toBe('prompt');
  });

  it('shows the steps on an iPhone or iPad, where a page can’t start it', () => {
    expect(installWay({ ...phone, ios: true })).toBe('ios');
  });

  it('offers nothing already open from the home screen', () => {
    expect(installWay({ ...phone, standalone: true, canPrompt: true })).toBeNull();
    expect(installWay({ ...phone, standalone: true, ios: true })).toBeNull();
  });

  it('offers nothing on a laptop, even where Chrome would install it', () => {
    expect(installWay({ ...phone, touch: false, canPrompt: true })).toBeNull();
  });

  it('shows the steps through the menu in Firefox on Android, which offers no dialog (D142)', () => {
    expect(installWay({ ...phone, firefoxAndroid: true })).toBe('firefox');
    expect(installWay({ ...phone, firefoxAndroid: true, standalone: true })).toBeNull();
  });

  it('offers nothing where the browser says none of these', () => {
    expect(installWay(phone)).toBeNull();
  });
});

describe('isIos', () => {
  it('knows an iPhone, and an iPad by its touchscreen though it says it’s a Mac', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
  });

  it('leaves a Mac and an Android phone out', () => {
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIos('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5)).toBe(false);
  });
});

describe('isFirefoxAndroid', () => {
  it('knows Firefox on Android, not Chrome there nor Firefox on a laptop', () => {
    expect(
      isFirefoxAndroid(
        'Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0',
      ),
    ).toBe(true);
    expect(
      isFirefoxAndroid(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131.0 Mobile Safari/537.36',
      ),
    ).toBe(false);
    expect(
      isFirefoxAndroid(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko Firefox/133.0',
      ),
    ).toBe(false);
  });
});
