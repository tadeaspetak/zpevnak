/**
 * A song's ChordPro written the one way the songbook writes it (D150), on every save: what
 * describes a printed page or another app goes, what has a second spelling gets the first.
 * Only the shape changes, never the words, the chords or what the song shows: a sheet read
 * before and after is the same sheet.
 */
import {
  droppedDirective,
  isDuration,
  parseSong,
  readDirective,
  readLabel,
} from './parse.ts';

/**
 * What a save changes, by kind, for the editor to say before it happens; in this order, what
 * matters most first.
 */
const KINDS = [
  /** Columns, page breaks, fonts, `{+pdf…}`: a printed page's, the reader's screen decides. */
  'layout',
  /** Another app's settings: SongBook's zoom and highlight marks, `{x_…}`. */
  'otherApp',
  /** `{c}`, `{soc}`, `{t}` written out. */
  'shortForm',
  /** `{comment_italic}`, `{comment_box}`, `{highlight}`: one look for comments. */
  'commentStyle',
  /** A subtitle repeating the artist goes; one standing for it becomes `{artist}`. */
  'subtitle',
  /** `{meta: year 1999}` as `{year: 1999}`. */
  'meta',
  /** `{genre}` as a `{tag}`: genre is what tags are for here (D118). */
  'genre',
  /** `{time: 3:05}` as `{duration}`. */
  'duration',
  /** `{metronome}` as `{tempo}`. */
  'tempo',
  /** `<b>`, `<span …>` in the lyrics: the sheet has one look. */
  'markup',
  /** "1", "Verse 2", "Ref" on a section that says so itself. */
  'sectionLabel',
  /** Spacing, capitals and indents: `{tag:- Pop -}` as `{tag: - Pop -}`. */
  'writing',
] as const;

type TidyKind = (typeof KINDS)[number];

export type Tidied = {
  source: string;
  /** Each kind once, in `KINDS`' order; empty when the text was already tidy. */
  changes: TidyKind[];
};

/** `{meta: name value}` names that have a directive of their own. */
const META_DIRECTIVES = new Set([
  'title',
  'subtitle',
  'artist',
  'key',
  'capo',
  'tempo',
  'time',
  'duration',
  'tag',
  'genre',
  'album',
  'year',
  'composer',
  'lyricist',
  'arranger',
  'copyright',
]);

/** Pango markup, as ChordPro 6 allows in lyrics. Only its own tags, so `<3` stays. */
const MARKUP_RE = /<\/?(?:b|i|u|s|tt|big|small|sub|sup)>|<span\b[^>]*>|<\/span>/g;

/** SongBook's highlight marks, inside a lyrics line. */
const HIGHLIGHT_RE = /\{\s*(?:soh|eoh)\s*\}/gi;

const RAW_NAME_RE = /^\{\s*([^\s:}]+)/;

/** A label the section's own look already says: a verse's number, the chorus's "Refrén". */
function sayingItsKind(name: string, label: string): boolean {
  if (name === 'start_of_verse') {
    return /^(?:(?:verse|sloka)\s*)?\d*\.?:?$/i.test(label);
  }
  if (name === 'start_of_chorus' || name === 'chorus') {
    return /^(?:chorus|refrén|refren|ref|r)\.?:?$/i.test(label);
  }
  return false;
}

const normal = (s: string) => s.trim().toLowerCase();

export function tidySource(source: string): Tidied {
  const newline = /\r\n/.test(source) ? '\r\n' : '\n';
  const lines = source.split(/\r\n|\r|\n/);
  const changes = new Set<TidyKind>();

  const song = parseSong(source);
  const artists = song.meta.artists.map(normal);
  // "Zuzana Navarová & KOA" as the subtitle, the same two as artists.
  const artistsAsOne = new Set(
    artists.length > 1
      ? [', ', ' & ', ' a ', ' and '].map((j) => artists.join(j))
      : artists,
  );
  const hasTempo = lines.some((l) => readDirective(l.trim())?.name === 'tempo');

  /** The directive as the songbook writes it, or null when it goes. */
  const tidyDirective = (raw: string): string | null => {
    const trimmed = raw.trim();
    const directive = readDirective(trimmed);
    if (!directive) {
      return raw;
    }
    const rawName = (RAW_NAME_RE.exec(trimmed)?.[1] ?? '').toLowerCase();
    let { name, value } = directive;
    // Whether this line changed for a reason of its own, so its spelling isn't counted too.
    let named = false;
    const mark = (kind: TidyKind) => {
      changes.add(kind);
      named = true;
    };

    const dropped = droppedDirective(name);
    if (dropped) {
      mark(dropped);
      return null;
    }
    if (name === 'meta') {
      const [metaName = '', ...rest] = value.split(/\s+/);
      if (META_DIRECTIVES.has(metaName) && rest.length > 0) {
        name = metaName;
        value = rest.join(' ');
        mark('meta');
      }
    }
    if (rawName === 'highlight' || name === 'comment_italic' || name === 'comment_box') {
      name = 'comment';
      mark('commentStyle');
    } else if (rawName !== name && rawName !== 'meta') {
      mark('shortForm');
    }

    switch (name) {
      case 'metronome':
        mark('tempo');
        if (hasTempo) {
          return null;
        }
        name = 'tempo';
        break;
      case 'time':
        if (isDuration(value)) {
          name = 'duration';
          mark('duration');
        }
        break;
      case 'genre':
        name = 'tag';
        mark('genre');
        break;
      case 'subtitle':
        if (value && artists.length === 0) {
          name = 'artist';
          mark('subtitle');
        } else if (artistsAsOne.has(normal(value))) {
          mark('subtitle');
          return null;
        }
        break;
      case 'start_of_verse':
      case 'start_of_chorus':
      case 'chorus': {
        const label = readLabel(value);
        if (label !== null && sayingItsKind(name, label)) {
          value = '';
          mark('sectionLabel');
        }
        break;
      }
    }

    // `{artist: }` waits to be filled in (the editor's template has it); a section takes none.
    const awaitsValue =
      !value && trimmed.includes(':') && !/^(?:(?:start|end)_of_|chorus$)/.test(name);
    const tidied = value
      ? `{${name}: ${value}}`
      : awaitsValue
        ? `{${name}: }`
        : `{${name}}`;
    if (!named && tidied !== raw) {
      changes.add('writing');
    }
    return tidied;
  };

  const out: string[] = [];
  let inTab = false;
  // A line taken out between two blank lines would leave both: the second goes with it.
  let dropBlank = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (dropBlank) {
      dropBlank = false;
      if (trimmed === '') {
        continue;
      }
    }
    if (trimmed.startsWith('#')) {
      out.push(raw);
      continue;
    }
    if (!trimmed.startsWith('{') || !readDirective(trimmed)) {
      let line = raw;
      if (!inTab) {
        const unmarked = line.replace(HIGHLIGHT_RE, '');
        if (unmarked !== line) {
          changes.add('otherApp');
        }
        line = unmarked.replace(MARKUP_RE, '');
        if (line !== unmarked) {
          changes.add('markup');
        }
      }
      out.push(line);
      continue;
    }
    const tidied = tidyDirective(raw);
    if (tidied === null) {
      dropBlank = out.length === 0 || out.at(-1)?.trim() === '';
      continue;
    }
    const name = readDirective(tidied)?.name ?? '';
    if (/^start_of_(?:tab|grid)$/.test(name)) {
      inTab = true;
    } else if (/^end_of_(?:tab|grid)$/.test(name)) {
      inTab = false;
    }
    out.push(tidied);
  }

  return { source: out.join(newline), changes: KINDS.filter((k) => changes.has(k)) };
}
