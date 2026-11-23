import { lyricsText, parseSong } from '#shared/chordpro/parse.ts';
import { tagKey, tagsIn } from '#shared/chordpro/tags.ts';
import type { SongRecord } from './store.ts';

type SongText = { lyrics: string; tags: string[] };

const cache = new Map<string, SongText>();

/** What lists and search read from a song's text: its words and its tags, once per version. */
export function songText(song: SongRecord): SongText {
  const key = `${song.id}:${song.updatedAt}`;
  let text = cache.get(key);
  if (text === undefined) {
    text = { lyrics: lyricsText(parseSong(song.source)), tags: tagsIn(song.source) };
    cache.set(key, text);
  }
  return text;
}

/**
 * The line under a song's title: its artist, then its tags after a pipe ("Lucie Bílá | Pohádky");
 * a song without an artist shows its tags alone (D120). Null when it has neither.
 */
export function byline(artist: string | null, tags: string[]): string | null {
  const seen = new Set<string>();
  const unique = tags.filter((tag) => !seen.has(tagKey(tag)) && seen.add(tagKey(tag)));
  const parts = [artist, unique.join(', ')].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : null;
}
