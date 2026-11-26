import { act, fireEvent, screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import { renderApp } from '#tests/client/render.tsx';
import { putNote, putPlaylist, putSong, settleNote } from '../../data/catalog.ts';
import type { NoteRecord, PlaylistRecord, SongRecord } from '../../data/store.ts';
import { AccountPage, NotesRedirect } from '../../pages/AccountPage.tsx';

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
  resolvedAt: null,
  createdAt: `2026-11-25T10:00:0${id}.000Z`,
  updatedAt: `2026-11-25T10:00:0${id}.000Z`,
  ...fields,
  // A playlist's note when it names one, unless the test says what it is.
  kind: fields.kind ?? (fields.playlistId ? 'playlist' : 'own'),
});

/** Where a link from the page went, and what it carried. */
function Arrived() {
  const location = useLocation();
  return <p>{`${location.pathname} ${JSON.stringify(location.state)}`}</p>;
}

async function open(notes: NoteRecord[], path = '/account?tab=notes') {
  renderApp(
    <Routes>
      <Route path="/account" element={<AccountPage />} />
      <Route path="/notes" element={<NotesRedirect />} />
      <Route path="*" element={<Arrived />} />
    </Routes>,
    { path },
  );
  // The device's copy (none here) is read first; the catalog comes after, as from a sync.
  await screen.findByRole('tab', { name: /^Poznámky/, selected: true });
  act(() => {
    putSong(song);
    putSong({ ...song, id: 9, title: 'Jiná' });
    putPlaylist(band.id, band);
    notes.forEach((n) => putNote(n.id, n));
  });
}

describe('Moje poznámky, the account’s tab (D135, D139)', () => {
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
    act(() =>
      [1, 2, 3, 4].forEach((id) => {
        putNote(id, null);
        // A delete or change that never got its answer here mustn't hide a note in the next.
        settleNote(id);
      }),
    );
    notifications.clean();
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
      '/account?tab=notes&filter=todo',
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
      backTo: '/account?tab=notes',
      backName: 'Moje poznámky',
      note: 2,
    });
  });

  /** The requests the page sent to `procedure`, their inputs. */
  const sent = (procedure: string) =>
    vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => String(input).includes(procedure))
      .map(([, init]) => JSON.parse(String(init?.body))[0]);

  it('changes a note right in the list: Enter saves, and it shows at once', async () => {
    await open([note(1, { todo: true })]);
    fireEvent.click(screen.getByRole('button', { name: 'Upravit poznámku: poznámka 1' }));
    const field = screen.getByRole('textbox', { name: 'Poznámka' });
    fireEvent.change(field, { target: { value: '  poznámka 1, opravená ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('poznámka 1, opravená')).toBeTruthy();
    await vi.waitFor(() =>
      expect(sent('notes.update')).toEqual([
        { id: 1, text: 'poznámka 1, opravená', todo: true, done: false },
      ]),
    );
  });

  it('saves a note on leaving the field; Shift+Enter is a new line, not a save', async () => {
    await open([note(1, {})]);
    fireEvent.click(screen.getByRole('button', { name: 'Upravit poznámku: poznámka 1' }));
    const field = screen.getByRole('textbox', { name: 'Poznámka' });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(screen.getByRole('textbox', { name: 'Poznámka' })).toBeTruthy();
    fireEvent.change(field, { target: { value: 'poznámka 1\na druhý řádek' } });
    fireEvent.blur(field);
    await vi.waitFor(() =>
      expect(sent('notes.update')).toEqual([
        { id: 1, text: 'poznámka 1\na druhý řádek', todo: false, done: false },
      ]),
    );
  });

  it('shows a note as the server has it again when a change is refused', async () => {
    await open([note(1, {})]);
    vi.mocked(fetch).mockImplementation(() => Promise.reject(new TypeError('refused')));
    fireEvent.click(screen.getByRole('button', { name: 'Upravit poznámku: poznámka 1' }));
    const field = screen.getByRole('textbox', { name: 'Poznámka' });
    fireEvent.change(field, { target: { value: 'nikdy uloženo' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByText('nikdy uloženo')).toBeTruthy();
    await vi.waitFor(() => expect(texts()).toEqual(['poznámka 1']));
    expect(screen.queryByText('nikdy uloženo')).toBeNull();
  });

  it('leaves a note as it was on Escape, emptied, or unchanged', async () => {
    await open([note(1, {})]);
    const edit = () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Upravit poznámku: poznámka 1' }),
      );
      return screen.getByRole('textbox', { name: 'Poznámka' });
    };
    let field = edit();
    fireEvent.change(field, { target: { value: 'něco jiného' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    field = edit();
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    field = edit();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(texts()).toEqual(['poznámka 1']);
    expect(sent('notes.update')).toEqual([]);
  });

  it('deletes a note at once, and takes it back with one tap before anything is sent', async () => {
    await open([note(1, {}), note(2, {})]);
    fireEvent.click(screen.getByRole('button', { name: 'Smazat poznámku: poznámka 1' }));
    expect(texts()).toEqual(['poznámka 2']);
    fireEvent.click(await screen.findByRole('button', { name: 'Beru zpátky' }));
    await vi.waitFor(() => expect(texts()).toEqual(['poznámka 2', 'poznámka 1']));
    await vi.waitFor(() => expect(screen.queryByText('Poznámka je smazaná.')).toBeNull());
    expect(sent('notes.delete')).toEqual([]);
  });

  it('sends the delete when the toast goes without an undo', async () => {
    await open([note(1, {})]);
    fireEvent.click(screen.getByRole('button', { name: 'Smazat poznámku: poznámka 1' }));
    await screen.findByText('Poznámka je smazaná.');
    expect(sent('notes.delete')).toEqual([]);
    act(() => notifications.hide('note-deleted-1'));
    await vi.waitFor(() => expect(sent('notes.delete')).toEqual([{ id: 1 }]));
  });

  it('lets one who edits the band’s playlist change and delete its note in the list', async () => {
    await open([note(1, { playlistId: 1, authorId: ME })]);
    fireEvent.click(screen.getByRole('button', { name: 'Upravit poznámku: poznámka 1' }));
    const field = screen.getByRole('textbox', { name: 'Poznámka' });
    fireEvent.change(field, { target: { value: 'Refrén třikrát' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await vi.waitFor(() =>
      expect(sent('notes.update')).toEqual([
        { id: 1, text: 'Refrén třikrát', todo: false, done: false },
      ]),
    );
    expect(screen.getByRole('button', { name: /Smazat poznámku/ })).toBeTruthy();
  });

  it('keeps the filter when /notes, where the notes were, redirects to the tab', async () => {
    await open([note(1, {}), note(2, { todo: true })], '/notes?filter=todo');
    expect(texts()).toEqual(['poznámka 2']);
  });

  it('counts the open TODOs on the tab', async () => {
    await open([note(1, { todo: true }), note(2, { todo: true }), note(3, {})]);
    expect(screen.getByLabelText('TODO: 2')).toBeTruthy();
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
    expect(screen.queryByRole('button', { name: /Smazat poznámku/ })).toBeNull();
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
    await vi.waitFor(() =>
      expect(sent('notes.update')).toEqual([
        { id: 1, text: 'poznámka 1', todo: true, done: true },
      ]),
    );
  });

  it('lists one’s reports, flagged; a fixed one kept, deleted but not rewritten (D143)', async () => {
    await open([
      note(1, { kind: 'report' }),
      note(2, { kind: 'report', resolvedAt: '2026-11-26T10:00:00.000Z' }),
    ]);
    expect(screen.getAllByRole('img', { name: 'Hlášení chyby' })).toHaveLength(2);
    expect(screen.getByText('Pro editory: chyba v písničce · Vyřešeno')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Upravit poznámku: poznámka 1' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Upravit poznámku: poznámka 2' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Smazat poznámku: poznámka 2' }),
    ).toBeTruthy();
    // Not one's own TODOs.
    fireEvent.click(screen.getByText('TODO'));
    expect(texts()).toEqual([]);
  });
});
