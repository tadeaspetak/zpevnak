import { cleanup, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderApp } from '#tests/client/render.tsx';
import type { SongRecord } from '../../data/store.ts';
import { SongToolbar } from '../SongToolbar.tsx';

const song = {
  id: 41,
  title: 'Píseň',
  artist: null,
  status: 'verified',
  source: '{title: Píseň}\nla la [A]la',
  updatedAt: '2026-11-22T10:00:00.000Z',
} as SongRecord;

function toolbar(semitones: number, shown: SongRecord = song, canEdit = false) {
  renderApp(
    <SongToolbar
      backTo="/"
      backLabel="Zpět"
      song={shown}
      originalKey="A"
      shownKey={semitones === 0 ? 'A' : 'H'}
      semitones={semitones}
      pitch={9}
      hasDiagrams={false}
      canEdit={canEdit}
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

describe('SongToolbar: the song’s tags (D118)', () => {
  beforeEach(() => {
    localStorage.setItem('zpevnak.locale', 'cs');
  });

  it('lists the tags in the menu, each leading to its songs', async () => {
    const tagged = {
      ...song,
      id: 42,
      source: '{title: Píseň}\n{tag: Vánoční}\n{tag: Lidová}\nla la [A]la',
    };
    toolbar(0, tagged);
    fireEvent.click(screen.getByRole('button', { name: 'Další možnosti' }));
    // Read the open menu at once: in jsdom it doesn't stay open for long.
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => [item.textContent, item.getAttribute('href')])).toEqual([
      ['Vánoční', '/tag/vanocni'],
      ['Lidová', '/tag/lidova'],
      ['Nahlásit chybu', expect.stringMatching(/^mailto:/)],
    ]);
  });

  it('shows no tags heading for a song without tags', async () => {
    toolbar(0);
    fireEvent.click(screen.getByRole('button', { name: 'Další možnosti' }));
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Nahlásit chybu']);
    expect(screen.queryByText('Štítky')).toBeNull();
  });
});

describe('SongToolbar: saving the key (D119)', () => {
  beforeEach(() => {
    localStorage.setItem('zpevnak.locale', 'cs');
  });

  const menu = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Další možnosti' }));
    return (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
  };

  it('offers whoever may edit the song to save it in the key it is transposed to', async () => {
    toolbar(2, song, true);
    expect(await menu()).toContain('Uložit v tónině H');
  });

  it('offers it to nobody else, and not in the song’s own key', async () => {
    toolbar(2, song, false);
    expect(await menu()).not.toContain('Uložit v tónině H');
    cleanup();
    toolbar(0, song, true);
    expect((await menu()).some((item) => item?.startsWith('Uložit'))).toBe(false);
  });
});
