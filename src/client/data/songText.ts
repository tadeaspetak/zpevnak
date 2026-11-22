import { lyricsText, parseSong } from '#shared/chordpro/parse.ts';
import { tagsIn } from '#shared/chordpro/tags.ts';
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
