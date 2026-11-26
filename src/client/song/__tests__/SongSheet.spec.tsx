import { screen } from '@testing-library/react';
import { renderApp } from '#tests/client/render.tsx';
import { describe, expect, it } from 'vitest';
import { parseSong } from '#shared/chordpro/parse.ts';
import { SongSheet } from '../SongSheet.tsx';

const song = parseSong(
  [
    '{title: Test}',
    '{define: Xsus4 frets x 0 2 2 3 0}',
    '{c: Intro}',
    '[Am] [Xsus4]',
    '',
    '{sov}',
    'la [Am]la [D]lo',
    '{eov}',
  ].join('\n'),
);

function sheet(showChords: boolean) {
  return renderApp(
    // One column: the hidden copy measured for columns would hold the same text twice.
    <SongSheet
      instrument="guitar"
      song={song}
      fontScale={1}
      showDiagrams
      showChords={showChords}
      showColumns={false}
    />,
  );
}

describe('SongSheet', () => {
  it('shows chords above the words, and the song’s diagrams', () => {
    const { container } = sheet(true);
    expect(screen.getAllByText('Am').length).toBeGreaterThan(0);
    expect(container.querySelector('figure')).not.toBeNull();
  });

  it('with chords off, shows the words alone: no chords, no chord-only lines, no diagrams', () => {
    const { container } = sheet(false);
    expect(screen.queryByText('Am')).toBeNull();
    expect(screen.queryByText('D')).toBeNull();
    expect(container.querySelector('figure')).toBeNull();
    // The verse reads as plain words; the intro, with nothing to sing, goes whole.
    expect(screen.getByText('la la lo')).toBeTruthy();
    expect(screen.queryByText('Intro')).toBeNull();
  });
});

describe('SongSheet: a chord on a pause', () => {
  it('takes no room of its own: its empty text is zero-width', () => {
    const { container } = renderApp(
      <SongSheet
        instrument="guitar"
        song={parseSong('{title: T}\nSvítá, [F] rozum šel [C]spát.')}
        fontScale={1}
        showDiagrams={false}
        showChords
        showColumns={false}
      />,
    );
    const pause = container.querySelector('[data-overhang]');
    expect(pause?.textContent).toBe('F​');
  });
});

describe('SongSheet: choruses', () => {
  it('marks every chorus, the first as much as a repeat, unless it has its own label', () => {
    localStorage.setItem('zpevnak.locale', 'cs');
    renderApp(
      <SongSheet
        instrument="guitar"
        song={parseSong(
          [
            '{title: T}',
            '{soc}',
            'la [C]la',
            '{eoc}',
            '{chorus}',
            '{soc: Refrén 2}',
            'lo [G]lo',
            '{eoc}',
          ].join('\n'),
        )}
        fontScale={1}
        showDiagrams={false}
        showChords
        showColumns={false}
      />,
    );
    expect(screen.getAllByText('Refrén')).toHaveLength(2);
    expect(screen.getByText('Refrén 2')).toBeTruthy();
  });
});

describe('SongSheet: notation and diagrams (D132)', () => {
  const english = parseSong('{title: T}\n{key: A}\nla [A]la [F#7]la [B7]la [Aaddb9]la');

  it('spells the chords the reader’s way: a Czech reader sees H7 for an English B7', () => {
    localStorage.setItem('zpevnak.locale', 'cs');
    renderApp(
      <SongSheet
        instrument="guitar"
        song={english}
        fontScale={1}
        showDiagrams={false}
        showColumns={false}
        notation="german"
      />,
    );
    expect(screen.getByText('H7')).toBeTruthy();
    expect(screen.queryByText('B7')).toBeNull();
  });

  it('draws every chord from the library, on the chosen instrument, and names what it can’t', () => {
    localStorage.setItem('zpevnak.locale', 'cs');
    const { container } = renderApp(
      <SongSheet
        song={english}
        fontScale={1}
        showDiagrams
        showColumns={false}
        instrument="ukulele"
      />,
    );
    const diagrams = [...container.querySelectorAll('figure')];
    expect(diagrams.map((d) => d.querySelector('figcaption')?.textContent)).toEqual([
      'A',
      'F#7',
      'B7',
      'Aaddb9',
    ]);
    // Four strings on a ukulele.
    expect(diagrams[0]?.querySelectorAll('line').length).toBe(6 + 4);
    expect(diagrams[3]?.textContent).toContain('bez diagramu');
  });
});
