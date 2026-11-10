import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSong } from '#shared/chordpro/parse.ts';
import { I18nProvider } from '../../i18n/index.tsx';
import { SongSheet } from '../SongSheet.tsx';

const song = parseSong(
  ['{title: Test}', '{columns: 2}', '{sov}', 'la [Am]la [D]lo', '{eov}'].join('\n'),
);

/**
 * jsdom lays nothing out, so the sizes the sheet measures are set here: the song in columns
 * (the hidden copy), the window, and a bar fixed at its bottom.
 */
function layout(sizes: { columns: number; window: number; bar?: number }) {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(sizes.columns);
  vi.stubGlobal('innerHeight', sizes.window);
  if (sizes.bar) {
    const bar = document.body.appendChild(document.createElement('nav'));
    bar.setAttribute('data-bottom-overlay', '');
    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue({
      top: sizes.window - sizes.bar,
    } as DOMRect);
  }
}

function bodyOf(container: HTMLElement, wide = true, showColumns = true) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  render(
    <I18nProvider>
      <SongSheet
        song={song}
        fontScale={1}
        showDiagrams={false}
        showColumns={showColumns}
      />
    </I18nProvider>,
    { container },
  );
  return container.querySelector('article > div:not([inert])');
}

describe('SongSheet columns (D25)', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.body.appendChild(document.createElement('div'));
  });
  afterEach(() => {
    document.querySelectorAll('[data-bottom-overlay]').forEach((el) => el.remove());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('lays the song in two columns when the song fits the screen that way', () => {
    // The title above it doesn't count: it scrolls away.
    layout({ columns: 800, window: 800 });
    expect(bodyOf(container)?.hasAttribute('data-columns')).toBe(true);
  });

  it('keeps one column when the columns would run past the bottom of the screen', () => {
    layout({ columns: 801, window: 800 });
    expect(bodyOf(container)?.hasAttribute('data-columns')).toBe(false);
  });

  it("doesn't count the room a bar at the bottom covers", () => {
    layout({ columns: 750, window: 800, bar: 60 });
    expect(bodyOf(container)?.hasAttribute('data-columns')).toBe(false);
  });

  it('keeps one column on a narrow screen, however short the song', () => {
    layout({ columns: 200, window: 800 });
    expect(bodyOf(container, false)?.hasAttribute('data-columns')).toBe(false);
  });

  it('keeps one column when the reader turned columns off', () => {
    layout({ columns: 200, window: 800 });
    expect(bodyOf(container, true, false)?.hasAttribute('data-columns')).toBe(false);
  });
});
