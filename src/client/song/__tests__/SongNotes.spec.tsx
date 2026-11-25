import { act, fireEvent, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSong } from '#shared/chordpro/parse.ts';
import { renderApp } from '#tests/client/render.tsx';
import { putNote, useCatalog } from '../../data/catalog.ts';
import { usePrefs } from '../../data/prefs.ts';
import type { NoteRecord, PlaylistRecord } from '../../data/store.ts';
import { useKeys } from '../../hooks/useKeys.ts';
import { SongSheet } from '../SongSheet.tsx';
import { useSongNotes } from '../SongNotes.tsx';

const SONG = parseSong(`{title: Píseň}
{start_of_verse}
la la [D]la
lu lu [A]lu
{end_of_verse}
{start_of_outro: Dohra}
[A] [D]
{end_of_outro}
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
  showChords = true,
}: {
  playlist: { id: number; name: string; role: PlaylistRecord['role'] } | null;
  showChords?: boolean;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const { loaded } = useCatalog();
  const notes = useSongNotes({ songId: SONG_ID, song: SONG, playlist, container });
  // The page's own keys: Escape leaves the song.
  useKeys({ Escape: leftTheSong });
  return (
    <>
      <button type="button" onClick={notes.startPicking}>
        začít vybírat
      </button>
      {/* As on the page: the sheet comes once the song is there, after a loader. */}
      {loaded ? (
        <div ref={setContainer} data-loaded>
          <SongSheet
            song={SONG}
            fontScale={1}
            showDiagrams={false}
            showChords={showChords}
            {...notes.sheet}
          />
          {notes.hoverButton}
        </div>
      ) : (
        <p>načítám</p>
      )}
      {notes.overlay}
    </>
  );
}

const leftTheSong = vi.fn();

async function play(
  playlist: Parameters<typeof Played>[0]['playlist'],
  notes: NoteRecord[],
  state?: unknown,
  showChords = true,
) {
  const { container } = renderApp(
    <Played playlist={playlist} showChords={showChords} />,
    { state },
  );
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

  it('scrolls to the note it was sent to, from one’s notes', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    await play(null, [note(1, {}), note(2, { line: null })], {
      backTo: '/notes',
      note: 1,
    });
    expect(scrolled.mock.contexts).toEqual([
      screen.getByText('poznámka 1').closest('button'),
    ]);
  });

  it('opens a line’s menu on a right-click, the sheet having come after a loader', async () => {
    const sheet = await play(null, []);
    fireEvent.contextMenu(sheet.querySelector('[data-place="1"]') as HTMLElement);
    // Read the open menu at once: in jsdom it doesn't stay open for long.
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Přidat poznámku',
      'Kopírovat řádek',
    ]);
  });

  it('keeps a note on an intro in sight with chords off', async () => {
    await play(null, [note(1, { line: { index: 2, text: 'A D' } })], undefined, false);
    expect(screen.getByText('poznámka 1')).toBeTruthy();
    expect(screen.queryByText('Dohra')).toBeNull();
  });

  it('gives up picking on Escape, wherever the focus is, without leaving the song', async () => {
    leftTheSong.mockClear();
    await play(null, []);
    const start = screen.getByRole('button', { name: 'začít vybírat' });
    start.focus();
    fireEvent.click(start);
    expect(
      screen.getByRole('dialog', { name: 'Vybrat řádek pro poznámku' }),
    ).toBeTruthy();
    fireEvent.keyDown(start, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: 'Vybrat řádek pro poznámku' }),
    ).toBeNull();
    expect(leftTheSong).not.toHaveBeenCalled();
  });

  it('puts a saved note on the sheet even when its dialog closed before the answer', async () => {
    let answer: ((response: Response) => void) | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        String(input).includes('notes.create')
          ? new Promise<Response>((resolve) => {
              answer = resolve;
            })
          : new Promise<Response>(() => {}),
      ),
    );
    const sheet = await play(null, []);
    fireEvent.contextMenu(sheet.querySelector('[data-place="1"]') as HTMLElement);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Přidat poznámku' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Poznámka' }), {
      target: { value: 'zpomalit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));
    // Closed meanwhile, as offline it closes by itself (D133).
    fireEvent.click(screen.getByRole('button', { name: 'Zrušit' }));
    // The request goes out on a later tick: answered once it has.
    await vi.waitFor(() => expect(answer).not.toBeNull());
    await act(async () => {
      answer?.(
        new Response(
          JSON.stringify([{ result: { data: note(4, { text: 'zpomalit' }) } }]),
          {
            headers: { 'content-type': 'application/json' },
          },
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(await screen.findByText('zpomalit')).toBeTruthy();
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
