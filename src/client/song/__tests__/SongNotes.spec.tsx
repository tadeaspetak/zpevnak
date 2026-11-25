import { act, fireEvent, renderHook, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSong } from '#shared/chordpro/parse.ts';
import { renderApp } from '#tests/client/render.tsx';
import { putNote, useCatalog } from '../../data/catalog.ts';
import { usePrefs } from '../../data/prefs.ts';
import type { NoteRecord, PlaylistRecord } from '../../data/store.ts';
import { SongSheet } from '../SongSheet.tsx';
import { useSongNotes } from '../SongNotes.tsx';

const SONG = parseSong(`{title: Píseň}
{start_of_verse}
la la [D]la
lu lu [A]lu
{end_of_verse}
`);
const SONG_ID = 7;
const ME = 3;

const note = (id: number, fields: Partial<NoteRecord>): NoteRecord => ({
  id,
  songId: SONG_ID,
  playlistId: null,
  authorId: ME,
  authorName: 'Já',
  text: `poznámka ${id}`,
  todo: false,
  doneAt: null,
  line: { index: 1, text: 'lu lu lu' },
  createdAt: `2026-11-25T10:00:0${id}.000Z`,
  updatedAt: `2026-11-25T10:00:0${id}.000Z`,
  ...fields,
});

/** The song as SongPage plays it, with its notes. */
function Played({
  playlist,
}: {
  playlist: { id: number; name: string; role: PlaylistRecord['role'] } | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const { loaded } = useCatalog();
  const notes = useSongNotes({ songId: SONG_ID, song: SONG, playlist, container });
  return (
    <>
      <button type="button" onClick={notes.startPicking}>
        začít vybírat
      </button>
      <div ref={container} data-loaded={loaded || undefined}>
        <SongSheet song={SONG} fontScale={1} showDiagrams={false} {...notes.sheet} />
        {notes.hoverButton}
      </div>
      {notes.overlay}
    </>
  );
}

async function play(
  playlist: Parameters<typeof Played>[0]['playlist'],
  notes: NoteRecord[],
) {
  const { container } = renderApp(<Played playlist={playlist} />);
  // The device's copy (none here) is read first; the notes come after, as from a sync.
  await vi.waitFor(() => expect(container.querySelector('[data-loaded]')).toBeTruthy());
  act(() => notes.forEach((n) => putNote(n.id, n)));
  return container;
}

const vrsek = (role: PlaylistRecord['role']) => ({ id: 1, name: 'Vršek', role });

describe('notes on the song view (D135)', () => {
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
    // The server never answers: what the device knows is all there is.
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

  it('shows one’s own notes under their line, and a playlist’s only playing from it', async () => {
    const notes = [note(1, {}), note(2, { playlistId: 1, text: 'refrén třikrát' })];
    const sheet = await play(null, notes);
    const line = sheet.querySelector('[data-place="1"]');
    expect(line?.nextElementSibling?.textContent).toBe('poznámka 1');
    expect(screen.queryByText('refrén třikrát')).toBeNull();
  });

  it('shows the band’s note to a reader of the playlist, without letting them change it', async () => {
    await play(vrsek('viewer'), [
      note(2, { playlistId: 1, authorId: 9, text: 'refrén třikrát' }),
    ]);
    const shown = screen.getByText('refrén třikrát');
    expect(shown.closest('button')).toBeNull();
  });

  it('opens the band’s note for whoever edits the playlist', async () => {
    await play(vrsek('collaborator'), [
      note(2, { playlistId: 1, authorId: 9, authorName: 'Bára', text: 'refrén třikrát' }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: /refrén třikrát/ }));
    expect(await screen.findByText('Autor: Bára')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Poznámka' })).toHaveProperty(
      'value',
      'refrén třikrát',
    );
  });

  it('keeps a note whose line is gone, at the top, saying which line it was', async () => {
    await play(null, [note(1, { line: { index: 1, text: 'slova, co už tu nejsou' } })]);
    expect(
      screen.getByText('Řádek „slova, co už tu nejsou“ se změnil:', { exact: false }),
    ).toBeTruthy();
    expect(screen.getByRole('banner').textContent).toContain('poznámka 1');
  });

  it('hides them all with the switch off, and shows them again', async () => {
    await play(null, [note(1, {})]);
    const prefs = renderHook(() => usePrefs()).result;
    act(() => prefs.current.setShowNotes(false));
    expect(screen.queryByText('poznámka 1')).toBeNull();
    act(() => prefs.current.setShowNotes(true));
    expect(screen.getByText('poznámka 1')).toBeTruthy();
  });

  it('picks a line from the ⋯ menu’s way in, and asks for the note there', async () => {
    const sheet = await play(vrsek('collaborator'), []);
    fireEvent.click(screen.getByRole('button', { name: 'začít vybírat' }));
    expect(screen.getByText(/Klikni na řádek/)).toBeTruthy();
    // Each line is a button now, for a keyboard too.
    const line = sheet.querySelector('[data-place="1"]') as HTMLElement;
    expect([line.getAttribute('role'), line.tabIndex]).toEqual(['button', 0]);
    fireEvent.click(line);
    expect(await screen.findByText('U řádku „lu lu lu“')).toBeTruthy();
    // Playing from a playlist they edit, they choose who it's for.
    expect(screen.getByText('Pro playlist Vršek')).toBeTruthy();
  });
});
