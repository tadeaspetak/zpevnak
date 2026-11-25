import { cleanup, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

type InPlaylist = {
  name: string;
  hasKey: boolean;
  canSetKey: boolean;
  setKey: (semitones: number) => void;
};

function toolbar(
  semitones: number,
  shown: SongRecord = song,
  canEdit = false,
  canDelete = canEdit,
  playlist: InPlaylist | null = null,
  own = semitones,
) {
  renderApp(
    <SongToolbar
      backTo="/"
      backLabel="Zpět"
      song={shown}
      shownKey={semitones === 0 ? 'A' : semitones === 2 ? 'H' : 'G'}
      baseKey={semitones === own ? 'A' : 'G'}
      semitones={semitones}
      own={own}
      pitch={9}
      hasDiagrams={false}
      canEdit={canEdit}
      canDelete={canDelete}
      canAddToPlaylist={false}
      hidden={false}
      playlist={playlist}
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
    expect(await menu()).toContain('Uložit pro všechny');
  });

  it('offers it to nobody else, and not in the song’s own key', async () => {
    toolbar(2, song, false);
    expect(await menu()).not.toContain('Uložit pro všechny');
    cleanup();
    toolbar(0, song, true);
    expect((await menu()).some((item) => item?.startsWith('Uložit'))).toBe(false);
  });
});

describe('SongToolbar: a private song (D127)', () => {
  beforeEach(() => {
    localStorage.setItem('zpevnak.locale', 'cs');
  });

  const menu = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Další možnosti' }));
    return (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
  };
  const mine = { ...song, status: 'private', role: 'collaborator' } as SongRecord;

  it('offers its people the sharing, a collaborator editing but not deleting', async () => {
    toolbar(0, mine, true, false);
    expect(await menu()).toEqual(['Sdílení', 'Upravit']);
  });

  it('offers no report to the songbook’s author, who can’t see the song', async () => {
    toolbar(0, { ...mine, role: 'viewer' } as SongRecord);
    expect(await menu()).toEqual(['Sdílení']);
  });

  it('offers the owner of a public song the sharing, to take it back', async () => {
    toolbar(0, { ...song, status: 'pending', role: 'owner' } as SongRecord, true);
    expect(await menu()).toContain('Sdílení');
  });
});

describe('SongToolbar: a key per playlist (D131)', () => {
  beforeEach(() => {
    localStorage.setItem('zpevnak.locale', 'cs');
  });

  const menu = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Další možnosti' }));
    return (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
  };
  const band = (hasKey: boolean, canSetKey = true) => ({
    name: 'Vršek',
    hasKey,
    canSetKey,
    setKey: vi.fn(),
  });

  it('offers who edits the playlist to play it there in the key they came to', async () => {
    const playlist = band(false);
    toolbar(2, song, false, false, playlist);
    fireEvent.click(screen.getByRole('button', { name: 'Další možnosti' }));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Hrát takhle v tomhle playlistu' }),
    );
    expect(playlist.setKey).toHaveBeenCalledWith(2);
  });

  it('starts from the playlist’s key: shown plainly, and the way back goes to it', async () => {
    // The playlist plays it a tone lower (G); the player went up two more, to A… here, H.
    toolbar(2, song, false, false, band(true), 4);
    expect(screen.getByRole('button', { name: 'H: Zpět na G' })).toBeTruthy();
    expect(await menu()).toContain('V playlistu hrát v tónině písničky');
  });

  it('offers nothing of the playlist’s key to a reader, or in the key it starts from', async () => {
    toolbar(2, song, false, false, band(true, false));
    expect(await menu()).not.toContain('Hrát takhle v tomhle playlistu');
    cleanup();
    toolbar(-2, song, false, false, band(true), 0);
    const items = await menu();
    expect(items.some((item) => item === 'Hrát takhle v tomhle playlistu')).toBe(false);
    expect(items).toContain('V playlistu hrát v tónině písničky');
  });

  it('offers saving for everyone only a key the player came to, not the playlist’s own', async () => {
    // The playlist plays it in G; the editor hasn't transposed it themselves.
    toolbar(-2, song, true, true, band(true), 0);
    expect(await menu()).not.toContain('Uložit pro všechny');
  });

  it('goes back to the playlist’s shift for a song that names no key, and says so', () => {
    // The playlist plays it 2 up, the player 1 more: the way back is to +2.
    renderApp(
      <SongToolbar
        backTo="/"
        backLabel="Zpět"
        song={song}
        shownKey={null}
        baseKey={null}
        semitones={3}
        own={1}
        pitch={null}
        hasDiagrams={false}
        canEdit={false}
        canDelete={false}
        canAddToPlaylist={false}
        hidden={false}
        playlist={band(true)}
      />,
    );
    expect(screen.getByRole('button', { name: '+3: Zpět na +2' })).toBeTruthy();
  });

  it('marks a key that is the playlist’s, in place of the clef', () => {
    toolbar(-2, song, false, false, band(true), 0);
    expect(screen.getByRole('img', { name: 'Tónina playlistu' })).toBeTruthy();
  });

  it('puts the key’s actions under one heading that names the key', async () => {
    toolbar(2, song, true, true, band(false));
    expect(await menu()).toEqual(
      expect.arrayContaining(['Uložit pro všechny', 'Hrát takhle v tomhle playlistu']),
    );
    expect(screen.getByText('Tónina H')).toBeTruthy();
  });
});
