import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSong } from '#shared/chordpro/parse.ts';
import { I18nProvider } from '../../i18n/index.tsx';
import { SongSheet } from '../SongSheet.tsx';

const song = parseSong(
  ['{title: Test}', '{columns: 2}', '{sov}', 'la [Am]la [D]lo', '{eov}'].join('\n'),
);

/**
 * jsdom lays nothing out, so the sizes the sheet measures are set here: the song in one
 * column, the hidden copy in two, the page around it and the window.
 */
function layout(sizes: { body: number; columns: number; page: number; window: number }) {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.hasAttribute('inert') ? sizes.columns : sizes.body;
  });
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(sizes.page);
  vi.stubGlobal('innerHeight', sizes.window);
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('lays the song in two columns when the whole page fits the screen that way', () => {
    // 200 around the song + 600 in columns = 800: exactly the window.
    layout({ body: 1200, columns: 600, page: 1400, window: 800 });
    expect(bodyOf(container)?.hasAttribute('data-columns')).toBe(true);
  });

  it('keeps one column when the columns would run past the bottom of the screen', () => {
    layout({ body: 1600, columns: 800, page: 1800, window: 800 });
    expect(bodyOf(container)?.hasAttribute('data-columns')).toBe(false);
  });

  it('keeps one column on a narrow screen, however short the song', () => {
    layout({ body: 400, columns: 200, page: 600, window: 800 });
    expect(bodyOf(container, false)?.hasAttribute('data-columns')).toBe(false);
  });

  it('keeps one column when the reader turned columns off', () => {
    layout({ body: 400, columns: 200, page: 600, window: 800 });
    expect(bodyOf(container, true, false)?.hasAttribute('data-columns')).toBe(false);
  });
});
