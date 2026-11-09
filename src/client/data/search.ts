import MiniSearch from 'minisearch';
import { useMemo } from 'react';
import { lyricsText, parseSong } from '#shared/chordpro/parse.ts';
import { fold } from '#shared/text.ts';
import { inSearch } from '#shared/songs.ts';
import { useMe } from '../hooks/useMe.ts';
import type { PlaylistRecord, SongRecord } from './store.ts';

type Indexed = { id: number; title: string; artist: string; lyrics: string };

export type SearchHit = {
  song: SongRecord;
  /** The lyrics line that matched, when the match wasn't in the title or artist. */
  lyricsLine: string | null;
};

const lyricsCache = new Map<string, string>();

/** The song's words, parsed once per version of the song. */
function lyricsOf(song: SongRecord): string {
  const key = `${song.id}:${song.updatedAt}`;
  let text = lyricsCache.get(key);
  if (text === undefined) {
    text = lyricsText(parseSong(song.source));
    lyricsCache.set(key, text);
  }
  return text;
}

function buildIndex(songs: SongRecord[]) {
  const index = new MiniSearch<Indexed>({
    fields: ['title', 'artist', 'lyrics'],
    processTerm: (term) => fold(term),
    searchOptions: {
      boost: { title: 4, artist: 2 },
      prefix: true,
      // One typo in words of five letters or more; short words must match exactly.
      fuzzy: (term) => (term.length >= 5 ? 1 : 0),
      combineWith: 'AND',
    },
  });
  index.addAll(
    songs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist ?? '',
      lyrics: lyricsOf(s),
    })),
  );
  return index;
}

function matchingLine(lyrics: string, terms: string[]): string | null {
  const lines = lyrics.split('\n');
  const folded = terms.map(fold);
  return (
    lines.find((line) => folded.every((t) => fold(line).includes(t))) ??
    lines.find((line) => folded.some((t) => fold(line).includes(t))) ??
    null
  );
}

function searchSongs(
  index: MiniSearch<Indexed>,
  songs: Map<number, SongRecord>,
  query: string,
): SearchHit[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  return index.search(trimmed).flatMap((result) => {
    const song = songs.get(result.id as number);
    if (!song) {
      return [];
    }
    // Every word found in the title or artist: that explains the hit, no lyrics line needed.
    const inHeader = Object.values(result.match).every((fields) =>
      fields.some((f) => f !== 'lyrics'),
    );
    return [
      { song, lyricsLine: inHeader ? null : matchingLine(lyricsOf(song), result.terms) },
    ];
  });
}

/**
 * The search index for the current catalog, rebuilt when the songs change. Only songs that can
 * be found: a rejected song is the author's alone to find (D77).
 */
export function useSongSearch(songs: Map<number, SongRecord>) {
  const viewerId = useMe().me?.id ?? null;
  return useMemo(() => {
    const index = buildIndex([...songs.values()].filter((s) => inSearch(s, viewerId)));
    return (query: string) => searchSongs(index, songs, query);
  }, [songs, viewerId]);
}

/** A–Z by title, the way Czech sorts (Č after C, Ch after H). */
export function sortByTitle(songs: Iterable<SongRecord>, locale: string): SongRecord[] {
  const collator = new Intl.Collator(locale === 'cs' ? 'cs' : 'en', {
    sensitivity: 'base',
  });
  return [...songs].sort((a, b) => collator.compare(a.title, b.title));
}

/** Playlists whose name holds every word of the query, diacritics and case aside. */
export function searchPlaylists(playlists: Iterable<PlaylistRecord>, query: string) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  return [...playlists].filter((p) => {
    const name = fold(p.name);
    return words.every((w) => name.includes(w));
  });
}
