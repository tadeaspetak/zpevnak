import MiniSearch from 'minisearch';
import { useMemo } from 'react';
import { fold } from '#shared/text.ts';
import { inSearch } from '#shared/songs.ts';
import { useMe } from '../hooks/useMe.ts';
import { songText } from './songText.ts';
import type { PlaylistRecord, SongRecord } from './store.ts';
import type { Tag } from './tags.ts';

type Indexed = {
  id: number;
  title: string;
  artist: string;
  tags: string;
  lyrics: string;
};

export type SearchHit = {
  song: SongRecord;
  /** The lyrics line that matched, when the match wasn't in the title, artist or tags. */
  lyricsLine: string | null;
  /** The song's tags the query matched: they say why a song is here that doesn't say so itself. */
  tags: string[];
};

function buildIndex(songs: SongRecord[]) {
  const index = new MiniSearch<Indexed>({
    fields: ['title', 'artist', 'tags', 'lyrics'],
    processTerm: (term) => fold(term),
    searchOptions: {
      boost: { title: 4, artist: 2, tags: 2 },
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
      tags: songText(s).tags.join(' '),
      lyrics: songText(s).lyrics,
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
    const { lyrics, tags } = songText(song);
    // Every word found in the title, artist or tags: that explains the hit, no lyrics line
    // needed.
    const inHeader = Object.values(result.match).every((fields) =>
      fields.some((f) => f !== 'lyrics'),
    );
    const tagTerms = Object.entries(result.match)
      .filter(([, fields]) => fields.includes('tags'))
      .map(([term]) => term);
    return [
      {
        song,
        lyricsLine: inHeader ? null : matchingLine(lyrics, result.terms),
        tags: tags.filter((tag) => tagTerms.some((term) => fold(tag).includes(term))),
      },
    ];
  });
}

/**
 * The search index for the current catalog, rebuilt when the songs change. Only songs that can
 * be found: a rejected song is the author's alone to find (D77).
 */
export function useSongSearch(songs: Map<number, SongRecord>) {
  const viewerId = useMe().me?.id ?? null;
  return useMemo(() => songSearch(songs, viewerId), [songs, viewerId]);
}

/** `useSongSearch` without React: a search over `songs` as `viewerId` may find them. */
export function songSearch(songs: Map<number, SongRecord>, viewerId: number | null) {
  const index = buildIndex([...songs.values()].filter((s) => inSearch(s, viewerId)));
  return (query: string) => searchSongs(index, songs, query);
}

/** A–Z by title, in the reader's order (`compare` from useI18n: Č after C in Czech). */
export function sortByTitle(
  songs: Iterable<SongRecord>,
  compare: (a: string, b: string) => number,
): SongRecord[] {
  return [...songs].sort((a, b) => compare(a.title, b.title));
}

/** Whether `name` holds every word of the query, diacritics and case aside. */
function holdsEveryWord(name: string, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const folded = fold(name);
  return words.length > 0 && words.every((w) => folded.includes(w));
}

/** Playlists whose name holds every word of the query. */
export function searchPlaylists(playlists: Iterable<PlaylistRecord>, query: string) {
  return [...playlists].filter((p) => holdsEveryWord(p.name, query));
}

/** Tags whose name holds every word of the query. */
export function searchTags(tags: Iterable<Tag>, query: string) {
  return [...tags].filter((tag) => holdsEveryWord(tag.name, query));
}
