/**
 * Songs copied from chord sites put the chords on a line of their own, above the words, lined up
 * by spaces. ChordPro puts them inside the words (`[Am]la la`). This turns the first into the
 * second, so a pasted song doesn't have to be retyped line by line.
 */

// Stricter than `parseChord`, which takes any suffix: here a word like "Ahoj" must not pass
// for A with a suffix, or every line starting with A–H would look like chords.
const CHORD_TOKEN =
  /^\(?[A-H](?:#|b|is|es)?(?:m|mi|min|maj|dim|aug|sus|add|M|\+|°|ø|\d|b|#|\(|\))*(?:\/[A-H](?:#|b)?)?\)?$/;
// What sits between chords on a chord line: bar lines, repeats, rests.
const FILLER = /^(?:\||\/|-|%|\.|x\d+|\(x\d+\)|\d+x|N\.?C\.?)$/i;

const SECTION_KINDS: [RegExp, 'verse' | 'chorus' | 'bridge' | null][] = [
  [/^(?:verse|sloka|strofa|\d+)$/i, 'verse'],
  [/^(?:chorus|refrén|refren|ref|r)$/i, 'chorus'],
  [/^(?:bridge|most|mezihra)$/i, 'bridge'],
  [/^(?:intro|outro|solo|předehra|dohra|coda|interlude)$/i, null],
];

/** A line of chords and nothing else, e.g. `C    G/H   Am7 |`. */
export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return (
    tokens.some((token) => CHORD_TOKEN.test(token)) &&
    tokens.every((token) => CHORD_TOKEN.test(token) || FILLER.test(token))
  );
}

/**
 * Whether the text has chord lines a ChordPro reader would show as words. Directives, comments
 * and tab sections are left out of it: tabs are meant to be read verbatim.
 */
export function looksLikeChordsOverLyrics(source: string): boolean {
  let inTab = false;
  for (const line of source.split(/\r\n|\r|\n/)) {
    const trimmed = line.trim();
    if (/^\{(?:start_of_(?:tab|grid)|sot|sog)\b/.test(trimmed)) {
      inTab = true;
    } else if (/^\{(?:end_of_(?:tab|grid)|eot|eog)\b/.test(trimmed)) {
      inTab = false;
    } else if (!inTab && !trimmed.startsWith('{') && !trimmed.startsWith('#')) {
      if (isChordLine(trimmed)) {
        return true;
      }
    }
  }
  return false;
}

type Header = { kind: 'verse' | 'chorus' | 'bridge' | null; label: string };

/** `[Verse 1]`, `Refrén:`, `R:`, `2.` and the like, alone on a line. */
function readHeader(line: string): Header | null {
  const match = /^\[?\s*([\p{L}]+|\d+)\.?\s*(\d*)\s*\]?\s*:?$/u.exec(line.trim());
  if (!match) {
    return null;
  }
  const [, word = '', number = ''] = match;
  const kind = SECTION_KINDS.find(([re]) => re.test(word));
  if (!kind || isChordLine(word)) {
    return null;
  }
  const label = /^\d+$/.test(word) ? `${word}.` : number ? `${word} ${number}` : word;
  return { kind: kind[1], label };
}

function expandTabs(line: string): string {
  let out = '';
  for (const ch of line) {
    out += ch === '\t' ? ' '.repeat(8 - (out.length % 8)) : ch;
  }
  return out;
}

/** Each chord of `chords` at its column, as `[C]` inside `lyrics`. */
export function mergeChordLine(chords: string, lyrics: string): string {
  const placed: { column: number; chord: string }[] = [];
  for (const match of expandTabs(chords).matchAll(/\S+/g)) {
    const token = match[0].replace(/^\((.*)\)$/, '$1');
    if (!FILLER.test(token)) {
      // `(G)`: the chord is where its letter is, not its bracket.
      const shift = token === match[0] ? 0 : 1;
      placed.push({ column: match.index + shift, chord: token });
    }
  }
  let text = expandTabs(lyrics).trimEnd();
  const last = placed.at(-1);
  if (last && last.column > text.length) {
    text = text.padEnd(last.column);
  }
  for (const { column, chord } of placed.toReversed()) {
    text = `${text.slice(0, column)}[${chord}]${text.slice(column)}`;
  }
  return text.trimEnd();
}

/** A line of chords with no words under it, spaced as it was: `[C]  [G]  [Am]`. */
function chordsAlone(chords: string): string {
  return chords
    .trim()
    .replace(/\S+/g, (token) =>
      FILLER.test(token) ? '' : `[${token.replace(/^\((.*)\)$/, '$1')}]`,
    )
    .replace(/\s+$/, '');
}

/**
 * The ChordPro for a song written as chords above lyrics. Lines that are already ChordPro
 * (directives, inline chords) are kept as they are.
 */
export function fromChordsOverLyrics(source: string): string {
  const lines = source.replace(/\s+$/, '').split(/\r\n|\r|\n/);
  const out: string[] = [];
  const hasTitle = /^\s*\{(?:title|t)\s*:/m.test(source);

  let i = 0;
  // A heading the chord sites put first: the title, then perhaps the artist, then a blank line.
  if (!hasTitle) {
    while (i < lines.length && lines[i]?.trim() === '') {
      i++;
    }
    const head: string[] = [];
    let j = i;
    while (j < lines.length && head.length < 3 && lines[j]?.trim()) {
      head.push(lines[j]?.trim() ?? '');
      j++;
    }
    const plain = (l: string) => !isChordLine(l) && !readHeader(l) && !/[[{]/.test(l);
    if (head.length > 0 && head.length <= 2 && head.every(plain) && j < lines.length) {
      out.push(`{title: ${head[0]}}`);
      if (head[1]) {
        out.push(`{artist: ${head[1]}}`);
      }
      i = j;
    }
  }

  let open: Header | null = null;
  const close = () => {
    if (open) {
      while (out.at(-1) === '') {
        out.pop();
      }
      out.push(`{end_of_${open.kind}}`, '');
      open = null;
    }
  };

  for (; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    const capo = /^(?:capo|kapodastr)\s*:?\s*(\d+)\.?$/i.exec(trimmed);
    const header = readHeader(trimmed);
    if (capo) {
      out.push(`{capo: ${capo[1]}}`);
    } else if (header) {
      close();
      if (header.kind) {
        out.push(`{start_of_${header.kind}: ${header.label}}`);
        open = header;
      } else {
        out.push(`{comment: ${header.label}}`);
      }
    } else if (isChordLine(trimmed)) {
      const next = lines[i + 1] ?? '';
      const nextIsLyrics =
        next.trim() !== '' &&
        !isChordLine(next) &&
        !readHeader(next) &&
        !next.trim().startsWith('{');
      if (nextIsLyrics) {
        out.push(mergeChordLine(line, next));
        i++;
      } else {
        out.push(chordsAlone(line));
      }
    } else {
      out.push(line.trimEnd());
    }
  }
  close();
  while (out.at(-1) === '') {
    out.pop();
  }
  return `${out.join('\n')}\n`;
}
