import { act, fireEvent, screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '#tests/client/render.tsx';
import { putNote, putSong } from '../../data/catalog.ts';
import type { NoteRecord, SongRecord } from '../../data/store.ts';
import { QueuePage } from '../QueuePage.tsx';

const song = {
  id: 7,
  title: 'Píseň',
  artist: null,
  status: 'verified',
  source: '{title: Píseň}\nla la [A]la',
  updatedAt: '2026-11-22T10:00:00.000Z',
} as SongRecord;

const report = (id: number, fields: Partial<NoteRecord> = {}): NoteRecord => ({
  id,
  songId: song.id,
  kind: 'report',
  playlistId: null,
  authorId: 9,
  authorName: 'Bára',
  text: `chyba ${id}`,
  todo: false,
  doneAt: null,
  line: { index: 0, text: 'la la la' },
  resolvedAt: null,
  createdAt: `2026-11-26T10:00:0${id}.000Z`,
  updatedAt: `2026-11-26T10:00:0${id}.000Z`,
  ...fields,
});

/** Where a link from the page went, and what it carried. */
function Arrived() {
  const location = useLocation();
  return <p>{`${location.pathname} ${JSON.stringify(location.state)}`}</p>;
}

async function open(notes: NoteRecord[]) {
  renderApp(
    <Routes>
      <Route path="/queue" element={<QueuePage />} />
      <Route path="*" element={<Arrived />} />
    </Routes>,
    { path: '/queue?status=reports' },
  );
  await screen.findByRole('tab', { name: /Hlášení/, selected: true });
  act(() => {
    putSong(song);
    notes.forEach((n) => putNote(n.id, n));
  });
}

describe('QueuePage: reports (D143)', () => {
  beforeEach(() => {
    localStorage.setItem('zpevnak.locale', 'cs');
    localStorage.setItem(
      'zpevnak.me',
      JSON.stringify({
        id: 3,
        email: 'editor@example.com',
        displayName: 'Editor',
        role: 'editor',
        locale: 'cs',
        emailVerified: true,
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    // Offline, as at a gig: the device's last answer says who this is, and its reports.
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  });
  afterEach(() => {
    act(() => [1, 2, 3].forEach((id) => putNote(id, null)));
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lists the open reports, the oldest first, counted on their tab; not a fixed one', async () => {
    await open([
      report(2),
      report(1),
      report(3, { resolvedAt: '2026-11-26T11:00:00.000Z' }),
    ]);
    expect(screen.queryAllByText(/^chyba \d$/).map((el) => el.textContent)).toEqual([
      'chyba 1',
      'chyba 2',
    ]);
    expect(screen.getByRole('tab', { name: /Hlášení/ }).textContent).toContain('2');
    expect(screen.getAllByText('U řádku „la la la“')).toHaveLength(2);
    expect(screen.getAllByText(/^Nahlásil\(a\): Bára · /)).toHaveLength(2);
  });

  it('leads to the report in its song, and back to the reports', async () => {
    await open([report(1)]);
    fireEvent.click(screen.getByText('chyba 1'));
    const arrived = await screen.findByText(/^\/song\//);
    expect(JSON.parse(arrived.textContent?.split(' ').slice(1).join(' ') ?? '')).toEqual({
      backTo: '/queue?status=reports',
      backName: 'Ke kontrole',
      note: 1,
    });
  });

  it('says when nothing is reported', async () => {
    await open([]);
    expect(screen.getByText('Žádné nahlášené chyby.')).toBeTruthy();
  });
});
