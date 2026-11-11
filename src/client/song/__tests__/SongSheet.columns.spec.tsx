import { act } from '@testing-library/react';
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

  it('measures again once a bar has slid out of the way, and in again (D109)', () => {
    // A line ending 40px from the bottom of a 1000px window, and a 60px bar over it.
    vi.stubGlobal('innerHeight', 1000);
    vi.spyOn(Range.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 900, 300, 60),
    );
    const bar = document.createElement('nav');
    bar.setAttribute('data-bottom-overlay', '');
    let barTop = 940;
    bar.getBoundingClientRect = () => new DOMRect(0, barTop, 1200, 60);
    document.body.append(bar);
    try {
      const { columns } = body(true, true);
      expect(columns).toBeNull();
      barTop = 1000;
      act(() => {
        bar.dispatchEvent(new Event('transitionend', { bubbles: true }));
      });
      expect(document.querySelector('[data-columns]')).not.toBeNull();
      barTop = 940;
      act(() => {
        bar.dispatchEvent(new Event('transitionend', { bubbles: true }));
      });
      expect(document.querySelector('[data-columns]')).toBeNull();
    } finally {
      bar.remove();
      vi.restoreAllMocks();
    }
  });
});
