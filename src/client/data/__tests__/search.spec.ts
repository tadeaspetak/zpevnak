import { describe, expect, it } from 'vitest';
import { searchPlaylists, songSearch, sortByTitle } from '../search.ts';
import type { PlaylistRecord, SongRecord } from '../store.ts';

let nextId = 1;
function song(
  title: string,
  artist: string | null,
  lyrics: string[],
  extra = {},
): SongRecord {
  const id = nextId++;
  return {
    id,
    title,
    artist,
    source: [`{title: ${title}}`, ...lyrics].join('\n'),
    status: 'verified',
    rejection: null,
    createdBy: null,
    updatedAt: '2026-11-10T10:00:00.000Z',
    ...extra,
  } as SongRecord;
}

const catalog = [
  song('Šumí les', 'Kapela Mech', ['[C]Šumí šumí [G]listí', 'lalala na kopci']),
  song('Hvězdy nad stájí', 'Koledníci', ['tichá noc nad [D]stájí', 'pastýři spí']),
  song('Kopretina', null, ['bílá kopretina', 'na louce stojí']),
  song('Cizí zamítnutá', null, ['tajný text'], { status: 'rejected', createdBy: 99 }),
];
const songs = new Map(catalog.map((s) => [s.id, s]));
const titles = (query: string, viewerId: number | null = null) =>
  songSearch(songs, viewerId)(query).map((hit) => hit.song.title);

describe('songSearch', () => {
  it('finds without diacritics or case, by the start of a word', () => {
    expect(titles('sumi')).toEqual(['Šumí les']);
    expect(titles('HVĚZ')).toEqual(['Hvězdy nad stájí']);
  });

  it('wants every word, from title, artist or lyrics alike', () => {
    expect(titles('kopretina louce')).toEqual(['Kopretina']);
    expect(titles('kopretina mech')).toEqual([]);
  });

  it('forgives one typo in a long word, never in a short one', () => {
    expect(titles('pastíři')).toEqual(['Hvězdy nad stájí']);
    expect(titles('lez')).toEqual([]);
  });

  it('shows the lyrics line that matched, the one with every word first', () => {
    const [hit] = songSearch(songs, null)('kopci lalala');
    expect(hit?.lyricsLine).toBe('lalala na kopci');
    const [only] = songSearch(songs, null)('pastýři');
    expect(only?.lyricsLine).toBe('pastýři spí');
  });

  it('shows no lyrics line when the title or artist explains the hit', () => {
    expect(songSearch(songs, null)('koledníci')[0]?.lyricsLine).toBeNull();
  });

  it("finds someone else's rejected song for nobody but its author (D77)", () => {
    expect(titles('tajný')).toEqual([]);
    expect(titles('tajný', 99)).toEqual(['Cizí zamítnutá']);
  });

  it('finds nothing for an empty query', () => {
    expect(titles('   ')).toEqual([]);
  });
});

describe('sortByTitle', () => {
  it('sorts the Czech way: Č after C, Ch after H', () => {
    const compare = new Intl.Collator('cs', { sensitivity: 'base' }).compare;
    const sorted = sortByTitle(
      ['Chata', 'Čáp', 'Hora', 'Cesta', 'Ivan'].map((t) => song(t, null, [])),
      compare,
    );
    expect(sorted.map((s) => s.title)).toEqual(['Cesta', 'Čáp', 'Hora', 'Chata', 'Ivan']);
  });
});

describe('searchPlaylists', () => {
  it('finds playlists holding every word of the query, diacritics aside', () => {
    const lists = [
      { id: 1, name: 'Vánoce u Nováků' },
      { id: 2, name: 'Vršek 2026' },
    ] as PlaylistRecord[];
    expect(searchPlaylists(lists, 'vanoce novaku').map((p) => p.id)).toEqual([1]);
    expect(searchPlaylists(lists, '2026 vánoce')).toEqual([]);
    expect(searchPlaylists(lists, ' ')).toEqual([]);
  });
});
