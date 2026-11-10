import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderApp } from '#tests/client/render.tsx';
import type { SongRecord } from '../../data/store.ts';
import { SongToolbar } from '../SongToolbar.tsx';

const song = { id: 41, title: 'Píseň', artist: null, status: 'verified' } as SongRecord;

function toolbar(semitones: number) {
  renderApp(
    <SongToolbar
      backTo="/"
      backLabel="Zpět"
      song={song}
      originalKey="A"
      shownKey={semitones === 0 ? 'A' : 'H'}
      semitones={semitones}
      hasDiagrams={false}
      hasColumns={false}
      canEdit={false}
      canAddToPlaylist={false}
      hidden={false}
    />,
  );
}

describe('SongToolbar: the key (D89)', () => {
  beforeEach(() => {
    localStorage.setItem('zpevnak.locale', 'cs');
  });

  it('only shows the key in the song’s own key: a tap does nothing (it used to reset)', () => {
    toolbar(0);
    expect(screen.queryByRole('button', { name: /Zpět na A/ })).toBeNull();
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('turns the transposed key into the way back', () => {
    localStorage.setItem('zpevnak.transpose', JSON.stringify({ [song.id]: 2 }));
    toolbar(2);
    fireEvent.click(screen.getByRole('button', { name: 'H: Zpět na A' }));
    expect(JSON.parse(localStorage.getItem('zpevnak.transpose') ?? '{}')).toEqual({});
  });
});
