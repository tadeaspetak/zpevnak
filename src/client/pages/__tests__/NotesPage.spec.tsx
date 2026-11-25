import { act, fireEvent, screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '#tests/client/render.tsx';
import { putNote, putPlaylist, putSong } from '../../data/catalog.ts';
import type { NoteRecord, PlaylistRecord, SongRecord } from '../../data/store.ts';
import { NotesPage } from '../NotesPage.tsx';

const ME = 3;
const song = {
  id: 7,
  title: 'Píseň',
  artist: null,
  status: 'verified',
  source: '{title: Píseň}\nla la [A]la',
  updatedAt: '2026-11-22T10:00:00.000Z',
} as SongRecord;
const band = {
  id: 1,
  name: 'Vršek',
  songIds: [9, 7],
  songKeys: {},
  role: 'owner',
  updatedAt: '2026-11-22T10:00:00.000Z',
} as unknown as PlaylistRecord;

const note = (id: number, fields: Partial<NoteRecord>): NoteRecord => ({
  id,
  songId: song.id,
  playlistId: null,
  authorId: ME,
  authorName: 'Já',
  text: `poznámka ${id}`,
  todo: false,
  doneAt: null,
  line: { index: 0, text: 'la la la' },
  createdAt: `2026-11-25T10:00:0${id}.000Z`,
  updatedAt: `2026-11-25T10:00:0${id}.000Z`,
  ...fields,
});

/** Where a link from the page went, and what it carried. */
function Arrived() {
  const location = useLocation();
  return <p>{`${location.pathname} ${JSON.stringify(location.state)}`}</p>;
}

async function open(notes: NoteRecord[], path = '/notes') {
  renderApp(
    <Routes>
      <Route path="/notes" element={<NotesPage />} />
      <Route path="*" element={<Arrived />} />
    </Routes>,
    { path },
  );
  // The device's copy (none here) is read first; the catalog comes after, as from a sync.
  await screen.findByRole('heading', { name: 'Moje poznámky' });
  act(() => {
    putSong(song);
    putSong({ ...song, id: 9, title: 'Jiná' });
    putPlaylist(band.id, band);
    notes.forEach((n) => putNote(n.id, n));
  });
}

describe('NotesPage (D135)', () => {
  beforeEach(() => {
    localStorage.setItem('zpevnak.locale', 'cs');
    localStorage.setItem(
      'zpevnak.me',
      JSON.stringify({
        id: ME,
        email: 'ja@example.com',
        displayName: 'Já',
        role: 'user',
        locale: 'cs',
        emailVerified: true,
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
  });
  afterEach(() => {
    act(() => [1, 2, 3, 4].forEach((id) => putNote(id, null)));
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  const texts = () => screen.queryAllByText(/^poznámka \d$/).map((el) => el.textContent);

  it('lists one’s own notes, newest first, and not someone else’s in a shared playlist', async () => {
    await open([
      note(1, {}),
      note(2, { playlistId: 1 }),
      note(3, { playlistId: 1, authorId: 9 }),
    ]);
    expect(texts()).toEqual(['poznámka 2', 'poznámka 1']);
    expect(screen.getByText(/Pro playlist „Vršek“/)).toBeTruthy();
  });

  it('filters to the TODOs still to do, or done, and keeps the filter in the address', async () => {
    await open(
      [
        note(1, {}),
        note(2, { todo: true }),
        note(3, { todo: true, doneAt: '2026-11-25T11:00:00.000Z' }),
      ],
      '/notes?filter=todo',
    );
    expect(texts()).toEqual(['poznámka 2']);
    fireEvent.click(screen.getByText('Hotové'));
    expect(texts()).toEqual(['poznámka 3']);
    fireEvent.click(screen.getByText('Vše'));
    expect(texts()).toEqual(['poznámka 3', 'poznámka 2', 'poznámka 1']);
  });

  it('says how to add a note when there is none, and when a filter finds none', async () => {
    await open([]);
    expect(screen.getByText(/podrž prst na řádku/)).toBeTruthy();
    act(() => putNote(1, note(1, {})));
    fireEvent.click(screen.getByText('TODO'));
    expect(screen.getByText('Žádné TODO, všechno hotovo.')).toBeTruthy();
  });

  it('leads to the note in its song: in its playlist for a playlist’s, scrolled to it', async () => {
    await open([note(2, { playlistId: 1 })]);
    fireEvent.click(screen.getByRole('link', { name: 'Ukázat v písničce' }));
    const arrived = await screen.findByText(/^\/playlist\//);
    expect(arrived.textContent).toMatch(/^\/playlist\/1-vrsek\/2 /);
    expect(JSON.parse(arrived.textContent?.split(' ').slice(1).join(' ') ?? '')).toEqual({
      backTo: '/notes',
      backName: 'Moje poznámky',
      note: 2,
    });
  });

  it('opens a note to change it, right there', async () => {
    await open([note(1, { todo: true })]);
    fireEvent.click(screen.getByRole('button', { name: 'Upravit poznámku: poznámka 1' }));
    expect(await screen.findByRole('checkbox', { name: 'Hotovo' })).toBeTruthy();
  });

  it('offers to change a band note only while one may edit the band’s playlist', async () => {
    await open([note(1, { playlistId: 1 })]);
    expect(screen.getByRole('button', { name: /Upravit poznámku/ })).toBeTruthy();
    act(() =>
      putPlaylist(band.id, {
        ...band,
        role: 'viewer',
        updatedAt: '2026-11-23T00:00:00.000Z',
      }),
    );
    expect(screen.queryByRole('button', { name: /Upravit poznámku/ })).toBeNull();
  });

  it('tells an account yet to confirm its email when it can write notes, not how', async () => {
    localStorage.setItem(
      'zpevnak.me',
      JSON.stringify({
        id: ME,
        email: 'ja@example.com',
        displayName: 'Já',
        role: 'user',
        locale: 'cs',
        emailVerified: false,
      }),
    );
    await open([]);
    expect(screen.getByText('Poznámky si můžeš psát, až potvrdíš e-mail.')).toBeTruthy();
    expect(screen.queryByText(/podrž prst/)).toBeNull();
  });

  it('names each song once, its notes under it, the song with the latest note first', async () => {
    await open([note(1, {}), note(2, { songId: 9 }), note(3, {})]);
    const headings = screen.getAllByRole('link', { name: /^(Píseň|Jiná)/ });
    expect(headings.map((h) => h.textContent)).toEqual(['Píseň', 'Jiná']);
    expect(texts()).toEqual(['poznámka 3', 'poznámka 1', 'poznámka 2']);
  });

  it('marks a TODO done in one tap', async () => {
    await open([note(1, { todo: true })]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hotovo: poznámka 1' }));
    await vi.waitFor(() => {
      const calls = vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => String(input).includes('notes.update'));
      expect(JSON.parse(String(calls[0]?.[1]?.body))).toEqual({
        0: { id: 1, text: 'poznámka 1', todo: true, done: true },
      });
    });
  });
});
