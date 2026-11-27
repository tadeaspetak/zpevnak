/**
 * A song written the old songbook's way, rewritten the way this songbook writes them (D151):
 * sections where the old one had headings in comments (`{c: REF}`, `{c: SLOKA}`), verses where
 * it had bare paragraphs, `Ami` as `Am`, `{c: capo 3}` as `{capo: 3}`, its own tags (`- Pop -`,
 * `- Zpěvník -`) as a tag or none. Judgement calls, unlike `tidySource`: the editor offers it,
 * never a save. Only the shape and the spelling of chords change, never the words.
 */
import { isHeaderLine, readDirective, readLabel } from './parse.ts';

/**
 * What arranging changes, by kind, for the editor to offer; in this order, what matters most
 * first.
 */
const KINDS = [
  /** Headings in comments and bare paragraphs as sections; a lone "REF" as `{chorus}`. */
  'sections',
  /** `Ami`, `Hmi7` as `Am`, `Hm7`. */
  'chords',
  /** The old songbook's own tags: a genre without its dashes, a status or the artist gone. */
  'tags',
  /** `{c: capo 3}` as `{capo: 3}`. */
  'capo',
  /** `08 Hush` as `Hush`: a band's set order, not the title. */
  'title',
  /** `{key:Am` closed. */
  'unclosed',
] as const;

type ArrangeKind = (typeof KINDS)[number];

export type Arranged = {
  source: string;
  /** Each kind once, in `KINDS`' order; empty when there's nothing to arrange. */
  changes: ArrangeKind[];
};

type Kind = 'verse' | 'chorus' | 'bridge' | 'intro' | 'interlude' | 'outro';

const HEADING_WORDS: [RegExp, Kind, string | null][] = [
  [/^(?:ref(?:r[eé]n)?|r|chorus)$/i, 'chorus', null],
  [/^(?:sloka|verse|strofa)$/i, 'verse', null],
  [/^(?:bridge|most)$/i, 'bridge', null],
  [/^(?:intro|předehra)$/i, 'intro', 'Předehra'],
  [/^(?:mezihra|interlude|instrumental)$/i, 'interlude', 'Mezihra'],
  [/^(?:s[oó]lo)$/i, 'interlude', 'Sólo'],
  [/^(?:outro|dohra|coda|ending)$/i, 'outro', 'Dohra'],
];

type Heading = {
  kind: Kind;
  /** The section's label: `Předehra`, or a chorus's number when the song has several. */
  label: string | null;
  number: string | null;
  /** What else the heading said ("2x", "keys"): kept, as a comment in the section. */
  note: string | null;
};

/** `REF`, `REF 2`, `REF 2x`, `SLOKA`, `2.`, `intro – keys` as a heading, or null. */
function readHeading(text: string): Heading | null {
  const verseNumber = /^(\d+)\.?$/.exec(text.trim());
  if (verseNumber) {
    return { kind: 'verse', label: null, number: null, note: null };
  }
  const match = /^([\p{L}]+)\.?\s*(\d*)\.?\s*(.*)$/u.exec(text.trim());
  if (!match) {
    return null;
  }
  const [, word = '', digits = '', rest = ''] = match;
  const known = HEADING_WORDS.find(([re]) => re.test(word));
  if (!known) {
    return null;
  }
  const [, kind, label] = known;
  // "R" alone is a chorus; "R. Křesťan" is a name. "verse 3 = 2" says where it's written.
  if ((/^r$/i.test(word) && (digits || rest.trim())) || rest.includes('=')) {
    return null;
  }
  // "REF 2x" is a repeat, "REF 2" the second chorus.
  const times = /^x\b/i.test(rest) && digits ? `${digits}x` : null;
  const note = [
    times,
    rest
      .replace(/^x\b/i, '')
      .replace(/^[\s\-–:,/]+/, '')
      .trim(),
  ]
    .filter(Boolean)
    .join(' ');
  return { kind, label, number: times ? null : digits || null, note: note || null };
}

/** The text of a `{comment}` line (any of its spellings), or null. */
function commentOf(line: string): string | null {
  const directive = readDirective(line.trim());
  return directive && /^comment(?:_italic|_box)?$/.test(directive.name)
    ? directive.value
    : null;
}

const START = (kind: Kind, label: string | null) =>
  label ? `{start_of_${kind}: ${label}}` : `{start_of_${kind}}`;
const END = (kind: Kind) => `{end_of_${kind}}`;

/** A line someone sings: words outside the chords, not only chords and bar lines. */
function isSung(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('#')) {
    return false;
  }
  return /\p{L}/u.test(trimmed.replace(/\[[^\]]*\]/g, ''));
}

/** The old songbook's statuses and lists: what someone does with a song, not what it is. */
const STATUS_TAGS = /^(?:!.*|zpěvník|novinky|ps oblíbené|po anglicku|vzpomínka na .*)$/i;

const normal = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, '');

/** `Ami`, `C#mi7`, `Hmi/F#` as `Am`, `C#m7`, `Hm/F#`; `Amin` and `Amaj7` stay. */
function chordWithM(chord: string): string {
  return chord.replace(/^([A-H](?:#|b)?)mi(?!n)/, '$1m');
}

export function arrangeSong(source: string): Arranged {
  const newline = /\r\n/.test(source) ? '\r\n' : '\n';
  const changes = new Set<ArrangeKind>();
  let lines = source.split(/\r\n|\r|\n/);

  // A directive left open (`{key:Am`, `{tag:Waldemar Matuška)`) reads as a sung line.
  lines = lines.map((line) => {
    const open = /^(\s*\{\s*[a-z_]+\s*:[^{}]*?)\)?\s*$/i.exec(line);
    if (open && !line.trim().endsWith('}')) {
      changes.add('unclosed');
      return `${open[1]}}`;
    }
    return line;
  });

  const artists = lines
    .map((l) => readDirective(l.trim()))
    .filter((d) => d?.name === 'artist' || d?.name === 'subtitle')
    .map((d) => normal(d?.value ?? ''));
  const hasCapo = lines.some((l) => readDirective(l.trim())?.name === 'capo');
  let capo: string | null = null;

  let inTab = false;
  lines = lines.flatMap((line) => {
    const trimmed = line.trim();
    const directive = trimmed.startsWith('{') ? readDirective(trimmed) : null;
    if (directive) {
      const { name, value } = directive;
      if (/^start_of_(?:tab|grid)$/.test(name)) {
        inTab = true;
      } else if (/^end_of_(?:tab|grid)$/.test(name)) {
        inTab = false;
      }
      if (name === 'title') {
        // A band's running order before the title: "08 Hush". Not "1 signální".
        const numbered = /^0\d\s+(.+)$/.exec(value);
        if (numbered) {
          changes.add('title');
          return [`{title: ${numbered[1]}}`];
        }
      }
      if (name === 'key' && chordWithM(value) !== value) {
        changes.add('chords');
        return [`{key: ${chordWithM(value)}}`];
      }
      if (name === 'tag') {
        const dashed = /^-\s*(.*?)\s*-$/.exec(value);
        const tag = dashed ? (dashed[1] ?? '') : value;
        if ((dashed && STATUS_TAGS.test(tag)) || artists.includes(normal(tag))) {
          changes.add('tags');
          return [];
        }
        if (dashed) {
          changes.add('tags');
          return [`{tag: ${tag}}`];
        }
      }
      const comment = commentOf(trimmed);
      const capoAt = comment === null ? null : /^capo\s*:?\s*(\d+)\.?$/i.exec(comment);
      if (capoAt && !hasCapo && capo === null) {
        capo = capoAt[1] ?? null;
        changes.add('capo');
        return [];
      }
      return [line];
    }
    if (inTab || trimmed.startsWith('#')) {
      return [line];
    }
    const respelled = line.replace(
      /\[([^\]]*)\]/g,
      (_, chord: string) => `[${chordWithM(chord)}]`,
    );
    if (respelled !== line) {
      changes.add('chords');
    }
    return [respelled];
  });

  if (capo !== null) {
    // Into the header, after its last line.
    let at = 0;
    while (
      at < lines.length &&
      (isHeaderLine(lines[at] ?? '') || lines[at]?.trim().startsWith('#'))
    ) {
      at++;
    }
    lines.splice(at, 0, `{capo: ${capo}}`);
  }

  const sectioned = arrangeSections(lines);
  if (sectioned.join('\n') !== lines.join('\n')) {
    changes.add('sections');
  }
  return {
    source: sectioned.join(newline),
    changes: KINDS.filter((k) => changes.has(k)),
  };
}

/** A run of lines between blank lines, outside any section, or a section as written. */
type Chunk =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'section'; kind: string; lines: string[] }
  | { type: 'blank'; line: string };

function chunksOf(lines: string[]): Chunk[] {
  const chunks: Chunk[] = [];
  let section: Extract<Chunk, { type: 'section' }> | null = null;
  for (const line of lines) {
    const directive = line.trim().startsWith('{') ? readDirective(line.trim()) : null;
    const start = directive && /^start_of_(\w+)$/.exec(directive.name);
    if (section) {
      section.lines.push(line);
      if (directive?.name.startsWith('end_of_')) {
        section = null;
      }
      continue;
    }
    if (start) {
      section = { type: 'section', kind: start[1] ?? '', lines: [line] };
      chunks.push(section);
      continue;
    }
    if (line.trim() === '') {
      chunks.push({ type: 'blank', line });
      continue;
    }
    const last = chunks.at(-1);
    if (last?.type === 'paragraph') {
      last.lines.push(line);
    } else {
      chunks.push({ type: 'paragraph', lines: [line] });
    }
  }
  return chunks;
}

/** A paragraph's heading, when its first line is one: `{c: REF}`. */
function headingOf(paragraph: string[]): Heading | null {
  const comment = commentOf(paragraph[0] ?? '');
  return comment === null ? null : readHeading(comment);
}

/** Lines the paragraph must keep as they are: the header, definitions, a `{chorus}`. */
function isUntouchable(paragraph: string[]): boolean {
  return paragraph.some((line) => {
    const directive = line.trim().startsWith('{') ? readDirective(line.trim()) : null;
    return directive !== null && commentOf(line) === null;
  });
}

/** A written chorus's number: its `{c: REF 2}` heading, or its "Refrén 2" label. */
function writtenChorusNumber(section: string[]): string | null {
  const inner = headingOf(section.slice(1, 2));
  if (inner?.kind === 'chorus' && inner.number) {
    return inner.number;
  }
  const label = readLabel(readDirective(section[0]?.trim() ?? '')?.value ?? '');
  return /^Refrén (\d+)$/.exec(label ?? '')?.[1] ?? null;
}

function arrangeSections(lines: string[]): string[] {
  const chunks = chunksOf(lines);
  // Choruses told apart by number ("REF 1", "REF 2") keep it as their label.
  // Either heading a paragraph, or first in a `{soc}`.
  const chorusNumbers = new Set(
    chunks.flatMap((c) => {
      if (c.type === 'section') {
        const number = c.kind === 'chorus' ? writtenChorusNumber(c.lines) : null;
        return number ? [number] : [];
      }
      const heading = c.type === 'paragraph' ? headingOf(c.lines) : null;
      return heading?.kind === 'chorus' && heading.number ? [heading.number] : [];
    }),
  );
  const numbered = chorusNumbers.size > 1;

  const out: string[] = [];
  // The chorus a `{chorus}` here would repeat: its number, '' for one without.
  let lastChorus: string | null = null;
  // A heading alone in its paragraph, waiting for the paragraph after it.
  let pending: Heading | null = null;
  // Its lines, and the blank lines after it, given back as they were if nothing takes it.
  let pendingLines: string[] = [];

  const section = (heading: Heading, content: string[]) => {
    const label =
      heading.kind === 'chorus'
        ? numbered && heading.number
          ? `Refrén ${heading.number}`
          : null
        : heading.label;
    if (heading.kind === 'chorus') {
      lastChorus = numbered ? (heading.number ?? '') : '';
    }
    return [
      START(heading.kind, label),
      ...(heading.note ? [`{comment: ${heading.note}}`] : []),
      ...content,
      END(heading.kind),
    ];
  };
  const flushPending = () => {
    out.push(...pendingLines);
    pending = null;
    pendingLines = [];
  };

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] as Chunk;
    if (chunk.type === 'blank') {
      if (pending) {
        pendingLines.push(chunk.line);
      } else {
        out.push(chunk.line);
      }
      continue;
    }
    if (chunk.type === 'section') {
      if (pending) {
        // "{c: REF}" right before "{soc}": the section says it already. Not "Bridge 2": that
        // tells two apart.
        const numberMatters = pending.number !== null && pending.kind !== 'verse';
        if (pending.kind === chunk.kind && !numberMatters) {
          out.push(...(pending.note ? [`{comment: ${pending.note}}`, ''] : []));
          pending = null;
          pendingLines = [];
        } else {
          flushPending();
        }
      }
      // `{soc}` then `{c: REF}`: the section says it already; `{c: REF 2}`, its label.
      const inner = headingOf(chunk.lines.slice(1, 2));
      const sameAsSection = inner?.kind === chunk.kind && !inner.note;
      const number = numbered ? (writtenChorusNumber(chunk.lines) ?? '') : '';
      const unlabelled = readDirective(chunk.lines[0]?.trim() ?? '')?.value === '';
      if (chunk.kind === 'chorus') {
        lastChorus = number;
      }
      out.push(
        ...chunk.lines.flatMap((line, at) => {
          if (at === 0 && number && unlabelled) {
            return [START('chorus', `Refrén ${number}`)];
          }
          return sameAsSection && at === 1 && (!number || unlabelled) ? [] : [line];
        }),
      );
      continue;
    }

    const heading = headingOf(chunk.lines);
    if (pending && !heading && !isUntouchable(chunk.lines)) {
      out.push(...section(pending, chunk.lines));
      pending = null;
      pendingLines = [];
      continue;
    }
    if (pending) {
      flushPending();
    }
    if (isUntouchable(chunk.lines)) {
      out.push(...chunk.lines);
      continue;
    }
    // Only headings, `{c: REF}` twice: sung twice, not a chorus holding a heading.
    const headings = chunk.lines.map((line) => headingOf([line]));
    if (chunk.lines.length > 1 && headings.every(Boolean)) {
      const repeated = headings.every((h) => h?.kind === 'chorus' && !h.number);
      if (repeated && lastChorus !== null && !numbered) {
        out.push(
          ...headings.flatMap((h) => [
            ...(h?.note ? [`{comment: ${h.note}}`] : []),
            '{chorus}',
          ]),
        );
      } else {
        out.push(...chunk.lines);
      }
      continue;
    }
    // `{c: REF}` twice, then a line: the chorus twice and a line more. Nothing says that.
    if (headings[0] && headings[1]) {
      out.push(...chunk.lines);
      continue;
    }
    if (heading && chunk.lines.length > 1) {
      out.push(...section(heading, chunk.lines.slice(1)));
      continue;
    }
    if (heading) {
      // Once the song has a chorus, a lone heading is it sung again, never the start of
      // another: `{chorus}` repeats the last one, so only if it's that one. An earlier one has
      // no directive: the heading stays as written.
      if (heading.kind === 'chorus' && lastChorus !== null) {
        const named = numbered ? (heading.number ?? '') : '';
        out.push(
          ...(named === lastChorus
            ? [...(heading.note ? [`{comment: ${heading.note}}`] : []), '{chorus}']
            : chunk.lines),
        );
        continue;
      }
      pending = heading;
      pendingLines = [...chunk.lines];
      continue;
    }
    if (chunk.lines.some(isSung)) {
      out.push(
        ...section({ kind: 'verse', label: null, number: null, note: null }, chunk.lines),
      );
      continue;
    }
    out.push(...chunk.lines);
  }
  if (pending) {
    flushPending();
  }
  return out;
}
