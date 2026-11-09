/**
 * Chord names and transposition.
 *
 * Two note-naming systems are in use in the songbook:
 * - `common` (English): B is B natural, B♭ is written Bb.
 * - `german` (Czech/German): H is B natural, B is B♭. Czech songs use this, and renaming
 *   H to B would silently change the chord, so transposition keeps the song's own system.
 */
export type NoteSystem = 'common' | 'german';

export type ParsedChord = {
  root: string;
  suffix: string;
  bass: string | null;
};

const CHORD_RE = /^([A-H])(#|b)?(.*?)(?:\/([A-H])(#|b)?)?$/;

// Pitch classes, C = 0.
const NATURALS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9 };

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
// Default spelling when there is no key to decide by: the names guitarists use most.
const MIXED_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Keys conventionally written with flats (majors and their relative minors).
const FLAT_KEYS = new Set([5, 10, 3, 8, 1, 6]); // F, Bb, Eb, Ab, Db, Gb (major)

function letterToPitch(letter: string, system: NoteSystem): number | null {
  if (letter === 'H') {
    return system === 'german' ? 11 : null;
  }
  if (letter === 'B') {
    return system === 'german' ? 10 : 11;
  }
  return NATURALS[letter] ?? null;
}

function notePitch(letter: string, accidental: string | undefined, system: NoteSystem) {
  const base = letterToPitch(letter, system);
  if (base === null) {
    return null;
  }
  // In german notation "Bb" would be a double flat; nobody writes that, so treat it as B♭.
  if (system === 'german' && letter === 'B' && accidental === 'b') {
    return 10;
  }
  const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (base + offset + 12) % 12;
}

function pitchName(pitch: number, names: string[], system: NoteSystem): string {
  const name = names[pitch] as string;
  if (system === 'german') {
    if (name === 'B') {
      return 'H';
    }
    if (name === 'Bb' || name === 'A#') {
      return 'B';
    }
  }
  return name;
}

/** Splits a chord name into root, suffix and bass. Returns null for non-chords (N.C., x, |). */
export function parseChord(name: string): ParsedChord | null {
  const match = CHORD_RE.exec(name.trim());
  if (!match) {
    return null;
  }
  const [, rootLetter, rootAcc = '', suffix = '', bassLetter, bassAcc = ''] = match;
  return {
    root: `${rootLetter}${rootAcc}`,
    suffix,
    bass: bassLetter ? `${bassLetter}${bassAcc}` : null,
  };
}

function splitNote(note: string): [string, string | undefined] {
  return [note.charAt(0), note.length > 1 ? note.charAt(1) : undefined];
}

/** The pitch class (0–11) of a note name such as `F#`, `Bb` or `H`. */
function pitchOf(note: string, system: NoteSystem): number | null {
  const [letter, acc] = splitNote(note);
  return notePitch(letter, acc, system);
}

/** Which spelling a key calls for. `key` may be minor (`Dm`). */
export function spellingForKey(key: string | null, system: NoteSystem): string[] {
  if (!key) {
    return MIXED_NAMES;
  }
  const parsed = parseChord(key);
  if (!parsed) {
    return MIXED_NAMES;
  }
  const pitch = pitchOf(parsed.root, system);
  if (pitch === null) {
    return MIXED_NAMES;
  }
  const isMinor = /^m(?!aj)/.test(parsed.suffix);
  const majorPitch = isMinor ? (pitch + 3) % 12 : pitch;
  if (FLAT_KEYS.has(majorPitch)) {
    return FLAT_NAMES;
  }
  if (majorPitch === 0 && !isMinor) {
    return MIXED_NAMES;
  }
  return SHARP_NAMES;
}

function transposeNote(
  note: string,
  semitones: number,
  system: NoteSystem,
  names: string[],
): string {
  const pitch = pitchOf(note, system);
  if (pitch === null) {
    return note;
  }
  return pitchName((((pitch + semitones) % 12) + 12) % 12, names, system);
}

/**
 * Transposes one chord name. Anything that isn't a chord (N.C., x, %) comes back unchanged.
 * `names` is the spelling table, from `spellingForKey` of the transposed key.
 */
export function transposeChord(
  name: string,
  semitones: number,
  system: NoteSystem,
  names: string[] = MIXED_NAMES,
): string {
  const step = ((semitones % 12) + 12) % 12;
  if (step === 0) {
    return name;
  }
  const parsed = parseChord(name);
  if (!parsed) {
    return name;
  }
  const root = transposeNote(parsed.root, step, system, names);
  const bass = parsed.bass ? `/${transposeNote(parsed.bass, step, system, names)}` : '';
  return `${root}${parsed.suffix}${bass}`;
}

/** The key a song ends up in after transposing, spelled sensibly for itself. */
export function transposeKey(key: string, semitones: number, system: NoteSystem): string {
  const target = transposeChord(key, semitones, system, MIXED_NAMES);
  return transposeChord(key, semitones, system, spellingForKey(target, system));
}
