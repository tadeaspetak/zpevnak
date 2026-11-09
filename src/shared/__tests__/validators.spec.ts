import { describe, expect, it } from 'vitest';
import { safeAppPath } from '../validators/index.ts';

describe('safeAppPath', () => {
  it.each(['/', '/join/AbC_123-xyz', '/playlist/1-vrsek/2', '/?q=lajla'])(
    'accepts the app path %s',
    (path) => {
      expect(safeAppPath(path)).toBe(path);
    },
  );

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'join/abc',
    '',
    null,
    undefined,
    `/${'x'.repeat(600)}`,
  ])('refuses %j', (path) => {
    expect(safeAppPath(path)).toBeNull();
  });
});
