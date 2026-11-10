import { renderApp } from '#tests/client/render.tsx';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseSong } from '#shared/chordpro/parse.ts';
import { SongSheet } from '../SongSheet.tsx';

const song = parseSong(
  // No {columns}: any song may go into columns (D108).
  ['{title: Test}', '{sov}', 'la [Am]la [D]lo', '{eov}'].join('\n'),
);

/** The song body, on a screen `wide` or not; whether it fits is `columnsFit`'s, tested there. */
function body(wide: boolean, showColumns: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const { container } = renderApp(
    <SongSheet
      song={song}
      fontScale={1}
      showDiagrams={false}
      showColumns={showColumns}
    />,
  );
  return {
    columns: container.querySelector('[data-columns]'),
    measured: container.querySelector('[inert]'),
  };
}

describe('SongSheet columns (D88, D108)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps one column on a narrow screen, and measures nothing', () => {
    expect(body(false, true)).toEqual({ columns: null, measured: null });
  });

  it('keeps one column when the reader turned columns off', () => {
    expect(body(true, false)).toEqual({ columns: null, measured: null });
  });

  it('tries any song in columns on a wide screen, whether or not it asks', () => {
    expect(body(true, true).measured).not.toBeNull();
  });
});
