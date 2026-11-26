import { notifications } from '@mantine/notifications';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '#tests/client/render.tsx';
import { putNote, putSong, settleNote } from '../../data/catalog.ts';
import type { NoteRecord, SongRecord } from '../../data/store.ts';
import { SongReports } from '../SongReports.tsx';

const song = { id: 7, title: 'Píseň', source: '{title: Píseň}' } as SongRecord;

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

describe('SongReports: the song’s open reports where it is fixed (D146)', () => {
  beforeEach(() => {
    localStorage.setItem('zpevnak.locale', 'cs');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
  });
  afterEach(() => {
    act(() =>
      [1, 2, 3].forEach((id) => {
        putNote(id, null);
        settleNote(id);
      }),
    );
    notifications.clean();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  const sent = () =>
    vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => String(input).includes('notes.resolve'))
      .map(([, init]) => JSON.parse(String(init?.body))[0]);

  it('lists the song’s open reports, not a fixed one nor another song’s', () => {
    renderApp(<SongReports songId={song.id} />);
    act(() => {
      putSong(song);
      putSong({ ...song, id: 8 });
      putNote(1, report(1));
      putNote(2, report(2, { resolvedAt: '2026-11-26T11:00:00.000Z' }));
      putNote(3, report(3, { songId: 8 }));
    });
    expect(screen.getByText('Nahlášené chyby: 1')).toBeTruthy();
    expect(screen.getByText('chyba 1')).toBeTruthy();
    expect(screen.queryByText('chyba 2')).toBeNull();
    expect(screen.queryByText('chyba 3')).toBeNull();
  });

  it('resolves one there at once, sent when the toast goes without an undo', async () => {
    renderApp(<SongReports songId={song.id} />);
    act(() => {
      putSong(song);
      putNote(1, report(1));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vyřešeno' }));
    expect(screen.queryByText('chyba 1')).toBeNull();
    expect(sent()).toEqual([]);
    act(() => notifications.hide('note-resolved-1'));
    await vi.waitFor(() => expect(sent()).toEqual([{ id: 1 }]));
  });

  it('shows nothing without reports', () => {
    renderApp(<SongReports songId={song.id} />);
    act(() => putSong(song));
    expect(screen.queryByText(/Nahlášené chyby/)).toBeNull();
  });
});
