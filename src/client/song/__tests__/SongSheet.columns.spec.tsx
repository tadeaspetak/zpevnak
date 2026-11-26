import { cleanup } from '@testing-library/react';
import { renderApp } from '#tests/client/render.tsx';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseSong } from '#shared/chordpro/parse.ts';
import { SongSheet } from '../SongSheet.tsx';

const song = parseSong(
  // No {columns}: any song may go into columns (D108).
  ['{title: Test}', '{sov}', 'la [Am]la [D]lo', '{eov}'].join('\n'),
);

/**
 * The song body, on a screen with `room` for two columns at its text size or not; whether the
 * song fits them is `columnsFit`'s, tested there.
 */
function body(room: boolean, showColumns: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: room,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const { container } = renderApp(
    <SongSheet
      instrument="guitar"
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

  it('measures nothing where two columns can’t fit at this text size (a phone upright)', () => {
    expect(body(false, true)).toEqual({ columns: null, measured: null });
  });

  it('keeps one column when the reader turned columns off', () => {
    expect(body(true, false)).toEqual({ columns: null, measured: null });
  });

  it('tries any song in columns where two could fit, a tablet upright too (D129)', () => {
    expect(body(true, true).measured).not.toBeNull();
  });

  it('counts a bar where it is shown, slid away or not: scrolling doesn’t rearrange (D136)', () => {
    // A line ending 40px from the bottom of a 1000px window, and a 60px bar over it when shown.
    vi.stubGlobal('innerHeight', 1000);
    vi.spyOn(Range.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 900, 300, 60),
    );
    const bar = document.createElement('nav');
    bar.setAttribute('data-bottom-overlay', '');
    // Slid down out of sight, as the toolbar goes on a scroll (D109).
    bar.style.transform = 'matrix(1, 0, 0, 1, 0, 60)';
    bar.getBoundingClientRect = () => new DOMRect(0, 1000, 1200, 60);
    document.body.append(bar);
    try {
      expect(body(true, true).columns).toBeNull();
    } finally {
      bar.remove();
    }
    try {
      // Without the bar, the same song fits: it was the bar that kept it in one column.
      cleanup();
      expect(body(true, true).columns).not.toBeNull();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
