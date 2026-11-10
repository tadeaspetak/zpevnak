import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseSong } from '#shared/chordpro/parse.ts';
import { I18nProvider } from '../../i18n/index.tsx';
import { SongSheet } from '../SongSheet.tsx';

const song = parseSong(
  ['{title: Test}', '{columns: 2}', '{sov}', 'la [Am]la [D]lo', '{eov}'].join('\n'),
);

/** The song body, on a screen `wide` or not; whether it fits is `columnsFit`'s, tested there. */
function body(wide: boolean, showColumns: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const { container } = render(
    <I18nProvider>
      <SongSheet
        song={song}
        fontScale={1}
        showDiagrams={false}
        showColumns={showColumns}
      />
    </I18nProvider>,
  );
  return {
    columns: container.querySelector('[data-columns]'),
    measured: container.querySelector('[inert]'),
  };
}

describe('SongSheet columns (D25, D88)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps one column on a narrow screen, and measures nothing', () => {
    expect(body(false, true)).toEqual({ columns: null, measured: null });
  });

  it('keeps one column when the reader turned columns off', () => {
    expect(body(true, false)).toEqual({ columns: null, measured: null });
  });
});
