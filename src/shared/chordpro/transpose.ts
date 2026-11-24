import {
  parseChord,
  pitchOf,
  spellingForKey,
  transposeChord,
  transposeKey,
} from './chord.ts';
import { parseSong, readDirective } from './parse.ts';
import type { Block, Line, Song } from './types.ts';

function transposeLine(line: Line, map: (chord: string) => string): Line {
  if (line.type !== 'lyrics') {
    return line;
  }
  return {
    type: 'lyrics',
    segments: line.segments.map((s) => ({ ...s, chord: s.chord && map(s.chord) })),
  };
}

function transposeBlock(block: Block, map: (chord: string) => string): Block {
  if (block.type === 'section') {
    return { ...block, lines: block.lines.map((l) => transposeLine(l, map)) };
  }
  if (block.type === 'chorusRecall' && block.chorus) {
    return { ...block, chorus: transposeBlock(block.chorus, map) };
  }
  return block;
}

/**
 * How `song`'s chords move by `semitones`: its new key, and each chord spelt for that key in the
 * song's own note system. Shared by the transposed view and the transposed text, so both agree.
 */
function transposition(song: Song, semitones: number) {
  const system = song.noteSystem;
  const key = song.meta.key ? transposeKey(song.meta.key, semitones, system) : null;
  const names = spellingForKey(key, system);
  return { key, map: (chord: string) => transposeChord(chord, semitones, system, names) };
}

/**
 * The song moved by `semitones`, in its own note system. Chord diagrams describe the
 * original voicings, so a transposed song carries none.
 */
export function transposeSong(song: Song, semitones: number): Song {
  if (semitones % 12 === 0) {
    return song;
  }
  const { key, map } = transposition(song, semitones);
  return {
    ...song,
    meta: { ...song.meta, key },
    definitions: [],
    blocks: song.blocks.map((b) => transposeBlock(b, map)),
  };
}

const TAB_START = /^start_of_(tab|grid)$/;
const TAB_END = /^end_of_(tab|grid)$/;

/**
 * The song's text rewritten `semitones` away: every chord in brackets and the `{key}`, as
 * `transposeSong` shows them; tabs and grids are left as written, as the view leaves them. Chord
 * diagrams (`{define}`, `{chord}`) are fingerings for the old chords and are dropped. Everything
 * else stays character for character.
 */
export function transposeSource(source: string, semitones: number): string {
  if (semitones % 12 === 0) {
    return source;
  }
  const { key, map } = transposition(parseSong(source), semitones);
  const newline = /\r\n/.test(source) ? '\r\n' : '\n';
  let inTab = false;
  const lines: string[] = [];
  for (const line of source.split(/\r\n|\r|\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      lines.push(line);
      continue;
    }
    const directive = trimmed.startsWith('{') ? readDirective(trimmed) : null;
    if (directive) {
      if (TAB_START.test(directive.name)) {
        inTab = true;
      } else if (TAB_END.test(directive.name)) {
        inTab = false;
      }
      if (directive.name === 'define' || directive.name === 'chord') {
        continue;
      }
      if (directive.name === 'key' && key && directive.value) {
        const at = line.lastIndexOf(directive.value);
        lines.push(line.slice(0, at) + key + line.slice(at + directive.value.length));
        continue;
      }
      lines.push(line);
      continue;
    }
    lines.push(
      inTab
        ? line
        : line.replace(/\[([^\]]*)\]/g, (_, chord: string) => `[${map(chord)}]`),
    );
  }
  return lines.join(newline);
}

/**
 * A transposition kept apart from the song's text (a device's, D24; a playlist's, D131):
 * semitones, and the pitch the song started from when they were set (`songPitch`), so it can
 * follow the song when its text changes key (D119). Semitones alone: set on a song that names
 * no key, or on a device before the pitch was kept.
 */
export type KeyShift = number | { semitones: number; from: number | null };

/**
 * How far to transpose a song that now starts from `from`, for `shift`. Saved in another key
 * since (D119), the song keeps sounding where it was put: "+3 from A" is "±0" once the text is
 * in C.
 */
export function semitonesFor(shift: KeyShift | undefined, from: number | null): number {
  if (shift === undefined) {
    return 0;
  }
  if (typeof shift === 'number') {
    return shift;
  }
  if (from === null || shift.from === null || from === shift.from) {
    return shift.semitones;
  }
  return nearest(shift.semitones + shift.from - from);
}

/** A shift the nearer way round, within ±6: −5 rather than +7. */
export function nearest(semitones: number): number {
  const moved = ((semitones % 12) + 12) % 12;
  return moved > 6 ? moved - 12 : moved;
}

/**
 * The pitch class a song starts from: its key, or else its first chord. A transposition kept on
 * a device is relative to it, so it can follow the song when the song's text changes key.
 */
export function songPitch(song: Song): number | null {
  const pitchOfChord = (chord: string | null) => {
    const parsed = chord ? parseChord(chord) : null;
    return parsed ? pitchOf(parsed.root, song.noteSystem) : null;
  };
  if (song.meta.key) {
    return pitchOfChord(song.meta.key);
  }
  for (const block of song.blocks) {
    if (block.type !== 'section') {
      continue;
    }
    for (const line of block.lines) {
      if (line.type !== 'lyrics') {
        continue;
      }
      for (const segment of line.segments) {
        const pitch = pitchOfChord(segment.chord);
        if (pitch !== null) {
          return pitch;
        }
      }
    }
  }
  return null;
}
