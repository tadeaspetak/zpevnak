import { act, cleanup, fireEvent, renderHook, screen } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSong } from '#shared/chordpro/parse.ts';
import { renderApp } from '#tests/client/render.tsx';
import { putNote, putPlaylist, settleNote, useCatalog } from '../../data/catalog.ts';
import { usePrefs } from '../../data/prefs.ts';
import type { NoteRecord, PlaylistRecord, SongRecord } from '../../data/store.ts';
import { useKeys } from '../../hooks/useKeys.ts';
import { SongSheet } from '../SongSheet.tsx';
import { useSongNotes } from '../SongNotes.tsx';

const SOURCE = `{title: Píseň}
{start_of_verse}
la la [D]la
lu lu [A]lu
{end_of_verse}
{start_of_outro: Dohra}
[A] [D]
{end_of_outro}
`;
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
  resolvedAt: null,
  createdAt: `2026-11-25T10:00:0${id}.000Z`,
  updatedAt: `2026-11-25T10:00:0${id}.000Z`,
  ...fields,
  // A playlist's note when it names one, unless the test says what it is.
  kind: fields.kind ?? (fields.playlistId ? 'playlist' : 'own'),
});

/** The song as SongPage plays it, with its notes. */
/** An approved song someone else wrote: the reader can't fix it, an editor can. */
const APPROVED = {
  id: 7,
  title: 'Píseň',
  artist: null,
  source: SOURCE,
  status: 'verified',
  createdBy: 99,
  role: null,
  updatedAt: '2026-11-25T09:00:00.000Z',
} as SongRecord;

function Played({
  playlist,
  showChords = true,
  source = SOURCE,
}: {
  playlist: Pick<PlaylistRecord, 'id' | 'name' | 'role' | 'isPublic'> | null;
  source?: string;
  showChords?: boolean;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const { loaded } = useCatalog();
  // As the catalog does when the song is saved elsewhere meanwhile.
  const [record, setRecord] = useState<SongRecord>({ ...APPROVED, source });
  const song = useMemo(() => parseSong(record.source), [record.source]);
  const notes = useSongNotes({
    songId: SONG_ID,
    song,
    record,
    playlist,
    container,
  });
  const location = useLocation();
  // The page's own keys: Escape leaves the song.
  useKeys({ Escape: leftTheSong });
  return (
    <>
      <button type="button" onClick={notes.startPicking}>
        začít vybírat
      </button>
      <button
        type="button"
        onClick={() =>
          setRecord({
            ...record,
            source: `{title: Píseň}\nnový první řádek\n${record.source.split('\n').slice(1).join('\n')}`,
            updatedAt: '2026-11-26T12:00:00.000Z',
          })
        }
      >
        změnit jinde
      </button>
      <output aria-label="kde">{`${location.pathname}${location.search}`}</output>
      {/* As on the page: the sheet comes once the song is there, after a loader. */}
      {loaded ? (
        <div ref={setContainer} data-loaded>
          <SongSheet
            instrument="guitar"
            song={song}
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
  source = SOURCE,
) {
  const { container } = renderApp(
    <Played playlist={playlist} showChords={showChords} source={source} />,
    { state },
  );
  // The device's copy (none here) is read first; the notes come after, as from a sync.
  await vi.waitFor(() => expect(container.querySelector('[data-loaded]')).toBeTruthy());
  act(() => notes.forEach((n) => putNote(n.id, n)));
  return container;
}

const vrsek = (role: PlaylistRecord['role'], name = 'Vršek', isPublic = false) => ({
  id: 1,
  name,
  role,
  isPublic,
});

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
    act(() =>
      [1, 2, 3, 4].forEach((id) => {
        putNote(id, null);
        // A delete that never got its answer here mustn't hide a note in the next test.
        settleNote(id);
      }),
    );
    notifications.clean();
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
    expect(await screen.findByText(/Autor: Bára/)).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveProperty(
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
    // A reader who can't fix this approved song may report a mistake at the line (D143).
    expect(items.map((item) => item.textContent)).toEqual([
      'Přidat poznámku',
      'Nahlásit chybu',
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
    fireEvent.change(await screen.findByRole('textbox', { name: 'Text' }), {
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
    expect(screen.getByRole('radio', { name: 'Pro playlist „Vršek“' })).toBeTruthy();
  });

  it('says who will read a band note, a public playlist’s anyone, and names it whole', async () => {
    const long = 'Vánoční koncert na náměstí Míru 2026 sbor';
    const sheet = await play(vrsek('owner', long, true), []);
    fireEvent.contextMenu(sheet.querySelector('[data-place="1"]') as HTMLElement);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Přidat poznámku' }));
    expect(
      await screen.findByRole('radio', { name: `Pro playlist „${long}“` }),
    ).toBeTruthy();
    expect(
      screen.getByText('Playlist je veřejný: uvidí ji každý, kdo ho otevře.'),
    ).toBeTruthy();
  });

  it('says whose a band note is when it’s opened to change', async () => {
    act(() =>
      putPlaylist(1, {
        id: 1,
        name: 'Vršek',
        role: 'collaborator',
        songIds: [SONG_ID],
        songKeys: {},
        updatedAt: '2026-11-25T00:00:00.000Z',
      } as unknown as PlaylistRecord),
    );
    await play(vrsek('collaborator'), [
      note(2, { playlistId: 1, authorId: 9, authorName: 'Bára', text: 'refrén třikrát' }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: /refrén třikrát/ }));
    expect(await screen.findByText('Pro playlist „Vršek“ · Autor: Bára')).toBeTruthy();
    act(() => putPlaylist(1, null));
  });

  it('takes a TODO done off the song: it’s in Moje poznámky, under Hotové', async () => {
    await play(null, [
      note(1, { todo: true }),
      note(2, { todo: true, doneAt: '2026-11-25T11:00:00.000Z' }),
    ]);
    expect(screen.getByText('poznámka 1')).toBeTruthy();
    expect(screen.queryByText('poznámka 2')).toBeNull();
  });

  it('deletes a note from its dialog at once, an undo in the toast, sent when it goes (D139)', async () => {
    await play(null, [note(1, {})]);
    const deleteIt = async () => {
      fireEvent.click(screen.getByRole('button', { name: /poznámka 1/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Smazat' }));
    };
    const sent = () =>
      vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => String(input).includes('notes.delete'));
    await deleteIt();
    // No question first, and the dialog is gone with the note.
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('poznámka 1')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Beru zpátky' }));
    await vi.waitFor(() => expect(screen.getByText('poznámka 1')).toBeTruthy());
    expect(sent()).toEqual([]);

    await deleteIt();
    await screen.findByText('Poznámka je smazaná.');
    act(() => notifications.hide('note-deleted-1'));
    await vi.waitFor(() => expect(sent()).toHaveLength(1));
  });

  it('shows a note written offline at once, waiting, not to be opened until it’s saved', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const sheet = await play(null, []);
      fireEvent.contextMenu(sheet.querySelector('[data-place="1"]') as HTMLElement);
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Přidat poznámku' }));
      fireEvent.change(await screen.findByRole('textbox', { name: 'Text' }), {
        target: { value: 'kapodastr' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));
      const waiting = await screen.findByText('kapodastr');
      expect(waiting.closest('[data-notes]')?.textContent).toContain('čeká na připojení');
      expect(waiting.closest('button')).toBeNull();
    } finally {
      online.mockRestore();
    }
  });

  describe('reports of a mistake (D143)', () => {
    const asEditor = () =>
      localStorage.setItem(
        'zpevnak.me',
        JSON.stringify({
          id: ME,
          email: 'ja@example.com',
          displayName: 'Já',
          role: 'editor',
          locale: 'cs',
          emailVerified: true,
        }),
      );
    const sent = (procedure: string) =>
      vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => String(input).includes(procedure))
        .map(([, init]) => JSON.parse(String(init?.body))[0]);

    it('reports a mistake at a line from its menu, as a report for the editors', async () => {
      const sheet = await play(null, []);
      fireEvent.contextMenu(sheet.querySelector('[data-place="1"]') as HTMLElement);
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Nahlásit chybu' }));
      expect(
        (
          await screen.findByRole('radio', { name: /Pro editory: chyba v písničce/ })
        ).getAttribute('aria-checked') ?? '',
      ).not.toBe('false');
      fireEvent.change(screen.getByRole('textbox', { name: 'Text' }), {
        target: { value: 'má tu být Hm' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Nahlásit' }));
      await vi.waitFor(() =>
        expect(sent('notes.create')).toEqual([
          {
            songId: SONG_ID,
            kind: 'report',
            playlistId: null,
            text: 'má tu být Hm',
            todo: false,
            line: { index: 1, text: 'lu lu lu' },
          },
        ]),
      );
    });

    it('lets its reporter change it, flagged, and an editor resolve it without rewriting it', async () => {
      const report = note(1, { kind: 'report', text: 'má tu být Hm' });
      await play(null, [report]);
      expect(screen.getByRole('img', { name: 'Hlášení chyby' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /má tu být Hm/ }));
      expect(await screen.findByRole('textbox', { name: 'Text' })).toBeTruthy();
      cleanup();

      asEditor();
      await play(null, [{ ...report, authorId: 9, authorName: 'Bára' }]);
      fireEvent.click(screen.getByRole('button', { name: /má tu být Hm/ }));
      expect(await screen.findByText('Nahlásil(a): Bára')).toBeTruthy();
      expect(screen.queryByRole('textbox')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Vyřešeno' }));
      // At once off the song, sent when the toast goes without an undo (D139).
      await vi.waitFor(() => expect(screen.queryByText('má tu být Hm')).toBeNull());
      expect(sent('notes.resolve')).toEqual([]);
      act(() => notifications.hide('note-resolved-1'));
      await vi.waitFor(() => expect(sent('notes.resolve')).toEqual([{ id: 1 }]));
    });

    it('keeps a fixed report off the song', async () => {
      await play(null, [
        note(1, { kind: 'report', resolvedAt: '2026-11-26T10:00:00.000Z' }),
      ]);
      expect(screen.queryByText('poznámka 1')).toBeNull();
    });

    it('lets an editor report a mistake too, and close their own report once fixed', async () => {
      asEditor();
      const sheet = await play(null, [note(1, { kind: 'report', text: 'má tu být Hm' })]);
      fireEvent.contextMenu(sheet.querySelector('[data-place="1"]') as HTMLElement);
      const items = await screen.findAllByRole('menuitem');
      expect(items.map((item) => item.textContent)).toContain('Nahlásit chybu');
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      // Their own: open to change, and resolved from there.
      fireEvent.click(screen.getByRole('button', { name: /má tu být Hm/ }));
      expect(await screen.findByRole('textbox', { name: 'Text' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Vyřešeno' }));
      // At once off the song, sent when the toast goes without an undo (D139).
      await vi.waitFor(() => expect(screen.queryByText('má tu být Hm')).toBeNull());
      expect(sent('notes.resolve')).toEqual([]);
      act(() => notifications.hide('note-resolved-1'));
      await vi.waitFor(() => expect(sent('notes.resolve')).toEqual([{ id: 1 }]));
    });
  });

  describe('comments written into the song (D145)', () => {
    const asEditor = () =>
      localStorage.setItem(
        'zpevnak.me',
        JSON.stringify({
          id: ME,
          email: 'ja@example.com',
          displayName: 'Já',
          role: 'editor',
          locale: 'cs',
          emailVerified: true,
        }),
      );
    const saved = () =>
      vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => String(input).includes('songs.update'))
        .map(([, init]) => JSON.parse(String(init?.body))[0]);
    const atLine = async (sheet: HTMLElement, place: number, item: string) => {
      fireEvent.contextMenu(
        sheet.querySelector(`[data-place="${place}"]`) as HTMLElement,
      );
      fireEvent.click(await screen.findByRole('menuitem', { name: item }));
    };

    it('lets whoever may change the song write a comment into it, after the line', async () => {
      asEditor();
      const sheet = await play(null, []);
      await atLine(sheet, 0, 'Přidat poznámku');
      fireEvent.click(await screen.findByRole('radio', { name: /zapsat do písničky/ }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Text' }), {
        target: { value: 'tiše' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Zapsat do písničky' }));
      await vi.waitFor(() =>
        expect(saved()).toEqual([
          {
            id: SONG_ID,
            source: SOURCE.replace('la la [D]la\n', 'la la [D]la\n{comment: tiše}\n'),
            seenAt: APPROVED.updatedAt,
          },
        ]),
      );
    });

    it('offers it to nobody else', async () => {
      const sheet = await play(null, []);
      await atLine(sheet, 0, 'Přidat poznámku');
      expect(await screen.findByRole('radio', { name: 'Jen pro mě' })).toBeTruthy();
      expect(screen.queryByRole('radio', { name: /zapsat do písničky/ })).toBeNull();
    });

    it('changes the song’s own comment where it is, and removes it with an undo', async () => {
      asEditor();
      const commented = SOURCE.replace('lu lu [A]lu\n', 'lu lu [A]lu\n{c: pomalu}\n');
      const sheet = await play(null, [], undefined, true, commented);
      await atLine(sheet, 2, 'Upravit komentář');
      const field = await screen.findByRole('textbox', { name: 'Text' });
      expect(field).toHaveProperty('value', 'pomalu');
      fireEvent.change(field, { target: { value: 'ještě pomaleji' } });
      fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));
      await vi.waitFor(() =>
        expect(saved().map((input) => input.source)).toEqual([
          commented.replace('{c: pomalu}', '{c: ještě pomaleji}'),
        ]),
      );
    });

    it('removes the song’s own comment from its dialog, at once', async () => {
      asEditor();
      const commented = SOURCE.replace('lu lu [A]lu\n', 'lu lu [A]lu\n{c: pomalu}\n');
      const sheet = await play(null, [], undefined, true, commented);
      await atLine(sheet, 2, 'Upravit komentář');
      fireEvent.click(await screen.findByRole('button', { name: 'Smazat' }));
      await vi.waitFor(() =>
        expect(saved().map((input) => input.source)).toEqual([SOURCE]),
      );
    });

    it('offers no one else the song’s comment to change', async () => {
      const commented = SOURCE.replace('lu lu [A]lu\n', 'lu lu [A]lu\n{c: pomalu}\n');
      const sheet = await play(null, [], undefined, true, commented);
      fireEvent.contextMenu(sheet.querySelector('[data-place="2"]') as HTMLElement);
      const items = await screen.findAllByRole('menuitem');
      expect(items.map((item) => item.textContent)).not.toContain('Upravit komentář');
    });
  });

  describe('reports and song comments, after the review and the walk (D143–D145)', () => {
    const asEditor = () =>
      localStorage.setItem(
        'zpevnak.me',
        JSON.stringify({
          id: ME,
          email: 'ja@example.com',
          displayName: 'Já',
          role: 'editor',
          locale: 'cs',
          emailVerified: true,
        }),
      );
    const calls = (procedure: string) =>
      vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => String(input).includes(procedure))
        .map(([, init]) => JSON.parse(String(init?.body))[0]);
    /** The server answering `procedure`, the rest left waiting. */
    const answer = <T,>(procedure: string, body: (input: T) => unknown, status = 200) =>
      vi.mocked(fetch).mockImplementation(((url: string, init?: RequestInit) =>
        String(url).includes(procedure)
          ? Promise.resolve(
              new Response(JSON.stringify([body(JSON.parse(String(init?.body))[0])]), {
                status,
                headers: { 'content-type': 'application/json' },
              }),
            )
          : new Promise<Response>(() => {})) as typeof fetch);
    /** Picks from a line's menu at once: in jsdom it doesn't stay open for long. */
    const pick = async (sheet: HTMLElement, place: number, item: string) => {
      fireEvent.contextMenu(
        sheet.querySelector(`[data-place="${place}"]`) as HTMLElement,
      );
      fireEvent.click(await screen.findByRole('menuitem', { name: item }));
    };

    it('names the dialog, the field and the button after whom the note is for', async () => {
      asEditor();
      const sheet = await play(null, []);
      await pick(sheet, 0, 'Přidat poznámku');
      expect(await screen.findByRole('heading', { name: 'Nová poznámka' })).toBeTruthy();
      expect(screen.getByRole('textbox', { name: 'Text' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Uložit' })).toBeTruthy();
      fireEvent.click(screen.getByRole('radio', { name: /Pro editory/ }));
      expect(screen.getByRole('heading', { name: 'Nahlásit chybu' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Nahlásit' })).toBeTruthy();
      fireEvent.click(screen.getByRole('radio', { name: /Pro všechny/ }));
      expect(screen.getByRole('heading', { name: 'Komentář do písničky' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Zapsat do písničky' })).toBeTruthy();
    });

    it('takes "Vyřešeno" back with one tap, sending nothing', async () => {
      asEditor();
      await play(null, [note(1, { kind: 'report', authorId: 9, text: 'má tu být Hm' })]);
      fireEvent.click(screen.getByRole('button', { name: /má tu být Hm/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Vyřešeno' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Beru zpátky' }));
      await vi.waitFor(() => expect(screen.getByText('má tu být Hm')).toBeTruthy());
      expect(calls('notes.resolve')).toEqual([]);
    });

    it('lets a report another editor resolved meanwhile go, saying so, not as an error', async () => {
      asEditor();
      answer(
        'notes.resolve',
        () => ({
          error: {
            message: 'NOT_FOUND',
            code: -32004,
            data: { code: 'NOT_FOUND', httpStatus: 404 },
          },
        }),
        404,
      );
      await play(null, [note(1, { kind: 'report', authorId: 9, text: 'má tu být Hm' })]);
      fireEvent.click(screen.getByRole('button', { name: /má tu být Hm/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Vyřešeno' }));
      act(() => notifications.hide('note-resolved-1'));
      expect(await screen.findByText('Tohle hlášení už někdo vyřešil.')).toBeTruthy();
      const { result } = renderHook(() => useCatalog());
      expect(result.current.notes.has(1)).toBe(false);
    });

    it('keeps one’s own report, resolved, as the server returns it', async () => {
      asEditor();
      const own = note(1, { kind: 'report', text: 'opravím' });
      answer('notes.resolve', () => ({
        result: { data: { note: { ...own, resolvedAt: '2026-11-26T12:00:00.000Z' } } },
      }));
      await play(null, [own]);
      fireEvent.click(screen.getByRole('button', { name: /opravím/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Vyřešeno' }));
      act(() => notifications.hide('note-resolved-1'));
      const { result } = renderHook(() => useCatalog());
      await vi.waitFor(() =>
        expect(result.current.notes.get(1)?.resolvedAt).toBe('2026-11-26T12:00:00.000Z'),
      );
    });

    it('offers reporting at a line to one signed out, through signing in', async () => {
      localStorage.removeItem('zpevnak.me');
      const sheet = await play(null, []);
      fireEvent.contextMenu(sheet.querySelector('[data-place="1"]') as HTMLElement);
      const items = await screen.findAllByRole('menuitem');
      expect(items.map((item) => item.textContent)).toEqual([
        'Nahlásit chybu',
        'Kopírovat řádek',
      ]);
      fireEvent.click(items[0] as HTMLElement);
      expect(screen.getByRole('status', { name: 'kde' }).textContent).toBe(
        `/login?next=${encodeURIComponent('/?report=1')}`,
      );
    });

    it('goes to the line of a report fixed since, the report no longer on the song', async () => {
      const scrolled = vi.fn();
      Element.prototype.scrollIntoView = scrolled;
      const sheet = await play(
        null,
        [note(1, { kind: 'report', resolvedAt: '2026-11-26T10:00:00.000Z' })],
        { backTo: '/account?tab=notes', note: 1 },
      );
      await vi.waitFor(() =>
        expect(scrolled.mock.contexts).toEqual([sheet.querySelector('[data-place="1"]')]),
      );
    });

    it('puts a removed song comment back with one tap, as a new version', async () => {
      asEditor();
      answer('songs.update', (input: { source: string }) => ({
        result: {
          data: {
            ...APPROVED,
            source: input.source,
            updatedAt: '2026-11-26T12:00:00.000Z',
          },
        },
      }));
      const commented = SOURCE.replace('lu lu [A]lu\n', 'lu lu [A]lu\n{c: pomalu}\n');
      const sheet = await play(null, [], undefined, true, commented);
      await pick(sheet, 2, 'Upravit komentář');
      fireEvent.click(await screen.findByRole('button', { name: 'Smazat' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Beru zpátky' }));
      await vi.waitFor(() =>
        expect(calls('songs.update')).toEqual([
          { id: SONG_ID, source: SOURCE, seenAt: APPROVED.updatedAt },
          { id: SONG_ID, source: commented, seenAt: '2026-11-26T12:00:00.000Z' },
        ]),
      );
    });

    it('writes into the song as it was when the dialog opened: a song changed since is refused, not edited at a moved line', async () => {
      asEditor();
      const sheet = await play(null, []);
      await pick(sheet, 0, 'Přidat poznámku');
      fireEvent.click(await screen.findByRole('radio', { name: /Pro všechny/ }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Text' }), {
        target: { value: 'tiše' },
      });
      // Saved elsewhere meanwhile: the device's copy moves on under the open dialog.
      fireEvent.click(screen.getByRole('button', { name: 'změnit jinde', hidden: true }));
      fireEvent.click(screen.getByRole('button', { name: 'Zapsat do písničky' }));
      await vi.waitFor(() =>
        expect(calls('songs.update')).toEqual([
          {
            id: SONG_ID,
            source: SOURCE.replace('la la [D]la\n', 'la la [D]la\n{comment: tiše}\n'),
            seenAt: APPROVED.updatedAt,
          },
        ]),
      );
    });
  });
});
