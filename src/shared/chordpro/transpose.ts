import { spellingForKey, transposeChord, transposeKey } from './chord.ts';
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
 * The song moved by `semitones`, in its own note system. Chord diagrams describe the
 * original voicings, so a transposed song carries none.
 */
export function transposeSong(song: Song, semitones: number): Song {
  if (semitones % 12 === 0) {
    return song;
  }
  const system = song.noteSystem;
  const newKey = song.meta.key ? transposeKey(song.meta.key, semitones, system) : null;
  const names = spellingForKey(newKey, system);
  const map = (chord: string) => transposeChord(chord, semitones, system, names);
  return {
    ...song,
    meta: { ...song.meta, key: newKey },
    definitions: [],
    blocks: song.blocks.map((b) => transposeBlock(b, map)),
  };
}
