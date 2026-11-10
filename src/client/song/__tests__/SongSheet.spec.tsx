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
    <SongSheet song={song} fontScale={1} showDiagrams showChords={showChords} />,
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
