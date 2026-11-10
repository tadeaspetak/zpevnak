/**
 * ChordPro parser: https://www.chordpro.org/chordpro/
 *
 * Covers what the songbook actually uses. Layout and PDF settings (`{+pdf...}`, fonts,
 * `{new_page}`) are accepted and ignored: they describe a printed page, and the app lays out
 * for the screen it is on. Anything not understood is kept out of the song and reported as a
 * warning, so an editor sees it rather than the text silently disappearing.
 */
import { parseChord, type NoteSystem } from './chord.ts';
import type {
  Block,
  ChordDefinition,
  ParseWarning,
  SectionKind,
  Segment,
  Song,
  SongMeta,
} from './types.ts';

type SectionBlock = Extract<Block, { type: 'section' }>;

const ENV_ALIASES: Record<string, string> = {
  soc: 'start_of_chorus',
  eoc: 'end_of_chorus',
  sov: 'start_of_verse',
  eov: 'end_of_verse',
  sob: 'start_of_bridge',
  eob: 'end_of_bridge',
  sot: 'start_of_tab',
  eot: 'end_of_tab',
  sog: 'start_of_grid',
  eog: 'end_of_grid',
};

const DIRECTIVE_ALIASES: Record<string, string> = {
  t: 'title',
  st: 'subtitle',
  k: 'key',
  c: 'comment',
  ci: 'comment_italic',
  cb: 'comment_box',
  highlight: 'comment',
  colb: 'column_break',
  col: 'columns',
  np: 'new_page',
  npp: 'new_physical_page',
};

const KNOWN_KINDS: Record<string, SectionKind> = {
  verse: 'verse',
  chorus: 'chorus',
  bridge: 'bridge',
  tab: 'tab',
  grid: 'grid',
};

/** Metadata the app doesn't use yet. Accepted silently: it is valid and harmless. */
const QUIET_METADATA = new Set([
  'album',
  'year',
  'composer',
  'lyricist',
  'arranger',
  'copyright',
  'duration',
  'sorttitle',
  'genre',
]);

/** Print-only directives. The screen layout replaces them. */
const PRINT_ONLY = new Set([
  'new_page',
  'new_physical_page',
  'pagetype',
  'titles',
  'diagrams',
  'grid',
  'no_grid',
  'metronome',
]);

const FORMATTING_RE = /(font|size|colou?r)$/;

type Directive = { name: string; value: string };

const DIRECTIVE_RE = /^\{\s*([^\s:}]+)\s*(?::\s*|\s+)?(.*?)\s*\}\s*$/;

function readDirective(line: string): Directive | null {
  const match = DIRECTIVE_RE.exec(line);
  if (!match) {
    return null;
  }
  const raw = (match[1] as string).toLowerCase();
  const name = ENV_ALIASES[raw] ?? DIRECTIVE_ALIASES[raw] ?? raw;
  return { name, value: match[2] ?? '' };
}

/** `label="Verse 1"` or a bare `Verse 1`. */
function readLabel(value: string): string | null {
  const attr = /label\s*=\s*"([^"]*)"/.exec(value);
  const label = attr ? attr[1] : value;
  return label?.trim() || null;
}

export function parseLyricsLine(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /\[([^\]]*)\]/g;
  let last = 0;
  let chord: string | null = null;
  for (const match of text.matchAll(re)) {
    const before = text.slice(last, match.index);
    if (before || chord !== null) {
      segments.push({ chord, text: before });
    }
    chord = match[1] as string;
    last = match.index + match[0].length;
  }
  const rest = text.slice(last);
  if (rest || chord !== null) {
    segments.push({ chord, text: rest });
  }
  return segments;
}

function parseFret(token: string): number | null {
  if (/^[xn-]$/i.test(token) || token === '-1') {
    return null;
  }
  const n = Number(token);
  return Number.isInteger(n) ? n : null;
}

type DefinitionProblem =
  { code: 'chordNoName' } | { code: 'chordNoFrets' | 'chordBadFrets'; chord: string };

/** Frets a diagram shows, counted from its base fret. */
export const DIAGRAM_FRETS = 5;

function readDefinition(value: string): ChordDefinition | DefinitionProblem {
  const tokens = value.split(/\s+/).filter(Boolean);
  const name = tokens.shift();
  if (!name) {
    return { code: 'chordNoName' };
  }
  let baseFret = 1;
  const frets: (number | null)[] = [];
  let fingers: (number | null)[] | null = null;
  let mode: 'frets' | 'fingers' | null = null;
  for (const token of tokens) {
    const keyword = token.toLowerCase();
    if (keyword === 'base-fret') {
      mode = null;
      continue;
    }
    if (keyword === 'frets' || keyword === 'fingers') {
      mode = keyword;
      if (keyword === 'fingers') {
        fingers = [];
      }
      continue;
    }
    if (mode === 'frets') {
      frets.push(parseFret(token));
    } else if (mode === 'fingers') {
      fingers?.push(parseFret(token));
    } else if (/^\d+$/.test(token)) {
      baseFret = Number(token);
    }
  }
  if (frets.length === 0) {
    return { code: 'chordNoFrets', chord: name };
  }
  // A diagram needs two strings at least, and its dots on the frets it draws.
  if (frets.length < 2 || frets.some((f) => f !== null && (f < 0 || f > DIAGRAM_FRETS))) {
    return { code: 'chordBadFrets', chord: name };
  }
  return { name, baseFret, frets, fingers };
}

function readNoteSystem(value: string): NoteSystem | null {
  const v = value.trim().toLowerCase();
  if (v === 'german' || v === 'scandinavian') {
    return 'german';
  }
  if (v === 'common' || v === 'dutch') {
    return 'common';
  }
  return null;
}

function emptyMeta(): SongMeta {
  return {
    title: null,
    subtitle: null,
    artists: [],
    key: null,
    capo: null,
    tempo: null,
    time: null,
    tags: [],
  };
}

export function parseSong(source: string): Song {
  const meta = emptyMeta();
  const blocks: Block[] = [];
  const definitions: ChordDefinition[] = [];
  const warnings: ParseWarning[] = [];
  let columns = 1;
  let declaredSystem: NoteSystem | null = null;

  // The section lines are going into: an explicit environment, or an implicit paragraph
  // (lines outside any environment, ended by a blank line).
  let current: SectionBlock | null = null;
  let explicit = false;
  let lastChorus: SectionBlock | null = null;

  const warn = (warning: ParseWarning) => warnings.push(warning);

  const closeImplicit = () => {
    if (current && !explicit) {
      current = null;
    }
  };

  let lineNo = 0;
  const target = (): SectionBlock => {
    if (!current) {
      current = {
        type: 'section',
        kind: 'other',
        name: null,
        label: null,
        lines: [],
        line: lineNo,
      };
      explicit = false;
      blocks.push(current);
    }
    return current;
  };

  const lines = source.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);

  lines.forEach((rawLine, index) => {
    lineNo = index + 1;
    const line = rawLine.trimEnd();

    if (line.trimStart().startsWith('#')) {
      return;
    }

    const directive = line.trimStart().startsWith('{')
      ? readDirective(line.trim())
      : null;
    if (!directive) {
      if (current?.kind === 'tab' || current?.kind === 'grid') {
        current.lines.push({ type: 'tab', text: line });
        return;
      }
      if (line.trim() === '') {
        if (explicit && current) {
          current.lines.push({ type: 'lyrics', segments: [] });
        } else {
          closeImplicit();
        }
        return;
      }
      target().lines.push({ type: 'lyrics', segments: parseLyricsLine(line) });
      return;
    }

    const { name, value } = directive;

    if (name.startsWith('+') || name.startsWith('x_')) {
      if (/^\+notes\.system$/.test(name)) {
        declaredSystem = readNoteSystem(value);
      }
      return;
    }

    const env = /^(start|end)_of_([a-z0-9_]+)$/.exec(name);
    if (env) {
      const [, edge, envName = ''] = env;
      if (edge === 'start') {
        if (explicit && current) {
          warn({ line: lineNo, code: 'startInsideSection', directive: name });
        }
        const kind = KNOWN_KINDS[envName] ?? 'other';
        const section: SectionBlock = {
          type: 'section',
          kind,
          name: kind === 'other' ? envName : null,
          label: readLabel(value),
          lines: [],
          line: lineNo,
        };
        blocks.push(section);
        current = section;
        explicit = true;
        if (kind === 'chorus') {
          lastChorus = section;
        }
      } else {
        if (!explicit || !current) {
          warn({ line: lineNo, code: 'endWithoutStart', directive: name });
        } else if (current.kind !== (KNOWN_KINDS[envName] ?? 'other')) {
          warn({ line: lineNo, code: 'endMismatch', directive: name });
        }
        current = null;
        explicit = false;
      }
      return;
    }

    switch (name) {
      case 'title':
        meta.title = value || null;
        return;
      case 'subtitle':
        meta.subtitle = value || null;
        return;
      case 'artist':
        if (value) {
          meta.artists.push(value);
        }
        return;
      case 'key':
        meta.key = value || null;
        return;
      case 'capo': {
        const capo = Number(value);
        if (Number.isInteger(capo) && capo >= 0) {
          meta.capo = capo;
        } else {
          warn({ line: lineNo, code: 'capoNotNumber', value });
        }
        return;
      }
      case 'tempo':
        meta.tempo = value || null;
        return;
      case 'time':
        meta.time = value || null;
        return;
      case 'tag':
        if (value) {
          meta.tags.push(value);
        }
        return;
      case 'comment':
      case 'comment_italic':
      case 'comment_box': {
        const style =
          name === 'comment' ? 'plain' : name === 'comment_italic' ? 'italic' : 'box';
        if (value) {
          target().lines.push({ type: 'comment', text: value, style });
        }
        return;
      }
      case 'chorus':
        closeImplicit();
        blocks.push({
          type: 'chorusRecall',
          label: readLabel(value),
          chorus: lastChorus ? structuredClone(lastChorus) : null,
          line: lineNo,
        });
        if (!lastChorus) {
          warn({ line: lineNo, code: 'chorusBeforeAny' });
        }
        return;
      case 'column_break':
        closeImplicit();
        blocks.push({ type: 'columnBreak' });
        return;
      case 'columns': {
        const n = Number(value);
        if (Number.isInteger(n) && n >= 1) {
          columns = n;
        }
        return;
      }
      case 'define':
      case 'chord': {
        const definition = readDefinition(value);
        if ('code' in definition) {
          warn({ ...definition, line: lineNo });
        } else {
          // Defined again: the later one counts, as in ChordPro.
          const same = definitions.findIndex((d) => d.name === definition.name);
          if (same !== -1) {
            definitions.splice(same, 1);
          }
          definitions.push(definition);
        }
        return;
      }
      case 'meta': {
        const [metaName = '', ...rest] = value.split(/\s+/);
        const metaValue = rest.join(' ');
        if (metaName === 'artist' && metaValue) {
          meta.artists.push(metaValue);
        } else if (metaName === 'tag' && metaValue) {
          meta.tags.push(metaValue);
        }
        return;
      }
    }

    if (QUIET_METADATA.has(name) || PRINT_ONLY.has(name) || FORMATTING_RE.test(name)) {
      return;
    }
    warn({ line: lineNo, code: 'unsupported', directive: name });
  });

  if (explicit && current) {
    warn({ line: lines.length, code: 'sectionNeverClosed' });
  }

  const song: Song = {
    meta,
    artist: meta.artists.length > 0 ? meta.artists.join(', ') : meta.subtitle,
    noteSystem: declaredSystem ?? detectNoteSystem(meta, blocks),
    columns,
    definitions,
    blocks: blocks.filter((b) => b.type !== 'section' || b.lines.length > 0 || b.label),
    warnings,
  };
  return song;
}

/** Without `{+notes.system}`, a song that uses H anywhere is in german notation. */
function detectNoteSystem(meta: SongMeta, blocks: Block[]): NoteSystem {
  const usesH = (chord: string | null) => {
    const parsed = chord ? parseChord(chord) : null;
    return parsed?.root === 'H' || parsed?.bass === 'H';
  };
  if (usesH(meta.key)) {
    return 'german';
  }
  for (const block of blocks) {
    if (block.type !== 'section') {
      continue;
    }
    for (const line of block.lines) {
      if (line.type === 'lyrics' && line.segments.some((s) => usesH(s.chord))) {
        return 'german';
      }
    }
  }
  return 'common';
}

/** The song's words without chords, one line per lyrics line. For search. */
export function lyricsText(song: Song): string {
  return song.blocks
    .flatMap((block) => (block.type === 'section' ? block.lines : []))
    .flatMap((line) =>
      line.type === 'lyrics'
        ? [
            line.segments
              .map((s) => s.text)
              .join('')
              .trim(),
          ]
        : [],
    )
    .filter(Boolean)
    .join('\n');
}
