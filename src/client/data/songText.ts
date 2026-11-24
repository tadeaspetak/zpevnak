import { chordIn, type NoteSystem, transposeKey } from '#shared/chordpro/chord.ts';
import { lyricsText, parseSong } from '#shared/chordpro/parse.ts';
import { tagKey, tagsIn } from '#shared/chordpro/tags.ts';
import { type KeyShift, semitonesFor, songPitch } from '#shared/chordpro/transpose.ts';
import type { SongRecord } from './store.ts';

type SongText = {
  lyrics: string;
  tags: string[];
  key: string | null;
  pitch: number | null;
  noteSystem: NoteSystem;
};

const cache = new Map<string, SongText>();

/** What lists and search read from a song's text: its words and its tags, once per version. */
export function songText(song: SongRecord): SongText {
  const key = `${song.id}:${song.updatedAt}`;
  let text = cache.get(key);
  if (text === undefined) {
    const parsed = parseSong(song.source);
    text = {
      lyrics: lyricsText(parsed),
      tags: tagsIn(song.source),
      key: parsed.meta.key,
      pitch: songPitch(parsed),
      noteSystem: parsed.noteSystem,
    };
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

/**
 * The key a song is played in under `shift` (a playlist's, D131), as a reader of `notation`
 * spells it (D132): null for a song that names no key, or no shift at all.
 */
export function keyUnder(
  song: SongRecord,
  shift: KeyShift | undefined,
  notation: NoteSystem,
): string | null {
  const { key, pitch, noteSystem } = songText(song);
  const semitones = semitonesFor(shift, pitch);
  return key && semitones !== 0
    ? chordIn(transposeKey(key, semitones, noteSystem), noteSystem, notation)
    : null;
}

/** How far a playlist's key (D131) moves a song as its text is now: 0 once it's its own key. */
export function shiftUnder(song: SongRecord, shift: KeyShift | undefined): number {
  return semitonesFor(shift, songText(song).pitch);
}
