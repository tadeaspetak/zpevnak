import { parseChord, pitchOf, type NoteSystem } from './chord.ts';
import { CHORD_SHAPES } from './chordShapes.ts';
import type { ChordDefinition, Song } from './types.ts';

export type Instrument = keyof typeof CHORD_SHAPES;
export const INSTRUMENTS = ['guitar', 'ukulele'] as const satisfies readonly Instrument[];

/**
 * A chord's suffix as songs write it (Czech "mi" for minor among them) → the library's name for
 * it. Anything not here has no shape: better no diagram than a wrong one.
 */
const SUFFIXES: Record<string, string> = {
  '': 'major',
  maj: 'major',
  m: 'minor',
  mi: 'minor',
  min: 'minor',
  '-': 'minor',
  '7': '7',
  m7: 'm7',
  mi7: 'm7',
  min7: 'm7',
  '-7': 'm7',
  maj7: 'maj7',
  M7: 'maj7',
  '7maj': 'maj7',
  Δ: 'maj7',
  Δ7: 'maj7',
  dim: 'dim',
  '°': 'dim',
  o: 'dim',
  dim7: 'dim7',
  '°7': 'dim7',
  aug: 'aug',
  '+': 'aug',
  '5+': 'aug',
  sus: 'sus4',
  sus4: 'sus4',
  sus2: 'sus2',
  '7sus': '7sus4',
  '7sus4': '7sus4',
  '6': '6',
  m6: 'm6',
  mi6: 'm6',
  '69': '69',
  '6/9': '69',
  '9': '9',
  m9: 'm9',
  mi9: 'm9',
  maj9: 'maj9',
  add9: 'add9',
  add2: 'add9',
  '2': 'add9',
  madd9: 'madd9',
  miadd9: 'madd9',
  '11': '11',
  m11: 'm11',
  '13': '13',
  m7b5: 'm7b5',
  mi7b5: 'm7b5',
  ø: 'm7b5',
  '7b5': '7b5',
  '7b9': '7b9',
  '7#9': '7#9',
  '7+': 'aug7',
  '7#5': 'aug7',
  aug7: 'aug7',
  mmaj7: 'mmaj7',
  mimaj7: 'mmaj7',
  'm(maj7)': 'mmaj7',
};

/**
 * A diagram for `chord` (as written in a song of `system`) on `instrument`, from the chord
 * library (D132), or null for a chord it doesn't know. A slash chord the library doesn't have
 * shows as its chord without the bass, named so.
 */
export function shapeFor(
  chord: string,
  system: NoteSystem,
  instrument: Instrument,
): ChordDefinition | null {
  // "(F#)": a chord played if at all, in brackets; its shape is the chord's.
  const parsed = parseChord(chord.replace(/^\((.*)\)$/, '$1'));
  const suffix = parsed ? SUFFIXES[parsed.suffix] : undefined;
  const root = parsed ? pitchOf(parsed.root, system) : null;
  if (!parsed || suffix === undefined || root === null) {
    return null;
  }
  const shapes = CHORD_SHAPES[instrument];
  const bass = parsed.bass ? pitchOf(parsed.bass, system) : null;
  const slash =
    bass !== null && (suffix === 'major' || suffix === 'minor')
      ? shapes[`${root}:${suffix === 'minor' ? 'm' : ''}/${bass}`]
      : undefined;
  const found = slash ?? shapes[`${root}:${suffix}`];
  if (!found) {
    return null;
  }
  const [baseFret, frets] = found;
  return {
    name: slash || !parsed.bass ? chord : chord.slice(0, chord.indexOf('/')),
    baseFret,
    frets: frets.map((fret) => (fret < 0 ? null : fret)),
    fingers: null,
  };
}

/**
 * The chords a song plays, each once, in the order they first come: the diagrams' order.
 * Annotations (`[*Riff]`) aren't chords.
 */
export function chordsOf(song: Song): string[] {
  const chords = new Set<string>();
  for (const block of song.blocks) {
    if (block.type !== 'section') {
      continue;
    }
    for (const line of block.lines) {
      if (line.type !== 'lyrics') {
        continue;
      }
      for (const { chord } of line.segments) {
        if (chord && !chord.startsWith('*')) {
          chords.add(chord);
        }
      }
    }
  }
  return [...chords];
}
