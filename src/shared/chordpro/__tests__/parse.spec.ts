import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lyricsText, parseLyricsLine, parseSong } from '../parse.ts';
import { transposeSong } from '../transpose.ts';

const song = (...lines: string[]) => parseSong(lines.join('\n'));

describe('parseLyricsLine', () => {
  it('splits a line into chord-led segments', () => {
    expect(parseLyricsLine('la [Am]la la [D]lo')).toEqual([
      { chord: null, text: 'la ' },
      { chord: 'Am', text: 'la la ' },
      { chord: 'D', text: 'lo' },
    ]);
  });

  it('keeps a chord at the end of the line', () => {
    expect(parseLyricsLine('end [E]')).toEqual([
      { chord: null, text: 'end ' },
      { chord: 'E', text: '' },
    ]);
  });

  it('keeps consecutive chords as separate segments', () => {
    expect(parseLyricsLine('[A][D]la')).toEqual([
      { chord: 'A', text: '' },
      { chord: 'D', text: 'la' },
    ]);
  });

  it('handles a chord in the middle of a word', () => {
    expect(parseLyricsLine('ka[Am]ra')).toEqual([
      { chord: null, text: 'ka' },
      { chord: 'Am', text: 'ra' },
    ]);
  });
});

describe('parseSong', () => {
  it('reads metadata, with short directive names and any case', () => {
    const s = song(
      '{t:Song}',
      '{st:Someone}',
      '{K: Dm}',
      '{Capo: 2}',
      '{tag:- Folk -}',
      '{tag:Band}',
    );
    expect(s.meta).toMatchObject({
      title: 'Song',
      subtitle: 'Someone',
      key: 'Dm',
      capo: 2,
      tags: ['- Folk -', 'Band'],
    });
    expect(s.warnings).toEqual([]);
  });

  it('prefers {artist} over {subtitle} for the artist, and joins several', () => {
    expect(song('{subtitle:Sub}').artist).toBe('Sub');
    expect(song('{subtitle:Sub}', '{artist:One}', '{artist:Two}').artist).toBe(
      'One, Two',
    );
    expect(song('{title:x}').artist).toBeNull();
  });

  it('reads environments with their long and short names and labels', () => {
    const s = song(
      '{start_of_verse: Verse 1}',
      '[A]one',
      '{end_of_verse}',
      '{soc}',
      'two',
      '{eoc}',
      '{start_of_bridge label="Middle"}',
      'three',
      '{end_of_bridge}',
      '{start_of_outro}',
      'four',
      '{end_of_outro}',
    );
    expect(
      s.blocks.map((b) => b.type === 'section' && [b.kind, b.name, b.label]),
    ).toEqual([
      ['verse', null, 'Verse 1'],
      ['chorus', null, null],
      ['bridge', null, 'Middle'],
      ['other', 'outro', null],
    ]);
    expect(s.warnings).toEqual([]);
  });

  it('knows the source line each part starts on, a repeated chorus included', () => {
    const s = song(
      '{title: x}',
      '',
      '{soc}',
      'la',
      '{eoc}',
      '',
      'lo',
      'li',
      '',
      '{chorus}',
    );
    expect(s.blocks.map((b) => [b.type, 'line' in b ? b.line : null])).toEqual([
      ['section', 3],
      ['section', 7],
      ['chorusRecall', 10],
    ]);
  });

  it('groups loose lines into paragraphs split by blank lines', () => {
    const s = song('{c: Intro}', '[A] [D]', '', 'one', 'two', '', '', 'three');
    expect(s.blocks).toHaveLength(3);
    expect(s.blocks[0]).toMatchObject({
      type: 'section',
      kind: 'other',
      lines: [{ type: 'comment', text: 'Intro', style: 'plain' }, { type: 'lyrics' }],
    });
  });

  it('keeps blank lines inside an environment as spacing', () => {
    const s = song('{soc}', 'one', '', 'two', '{eoc}');
    expect(s.blocks).toHaveLength(1);
    const block = s.blocks[0];
    expect(block?.type === 'section' && block.lines).toHaveLength(3);
  });

  it('repeats the previous chorus for {chorus}', () => {
    const s = song('{soc}', '[G]la', '{eoc}', '{sov}', 'v', '{eov}', '{chorus}');
    const recall = s.blocks[2];
    expect(recall).toMatchObject({
      type: 'chorusRecall',
      chorus: { kind: 'chorus', lines: [{ segments: [{ chord: 'G', text: 'la' }] }] },
    });
  });

  it('warns when {chorus} has nothing to repeat', () => {
    expect(song('{chorus}').warnings[0]?.code).toBe('chorusBeforeAny');
  });

  it('reads chord definitions', () => {
    const s = song(
      '{define: Aaddb9* base-fret 5 frets 1 x x 2 1 2}',
      '{define: Dsus2 base-fret 1 frets x x 0 2 3 0 fingers 0 0 0 2 3 0}',
    );
    expect(s.definitions).toEqual([
      { name: 'Aaddb9*', baseFret: 5, frets: [1, null, null, 2, 1, 2], fingers: null },
      {
        name: 'Dsus2',
        baseFret: 1,
        frets: [null, null, 0, 2, 3, 0],
        fingers: [0, 0, 0, 2, 3, 0],
      },
    ]);
  });

  it('reads columns and column breaks', () => {
    const s = song(
      '{columns: 2}',
      '{sov}',
      'a',
      '{eov}',
      '{column_break}',
      '{sov}',
      'b',
      '{eov}',
    );
    expect(s.columns).toBe(2);
    expect(s.blocks.map((b) => b.type)).toEqual(['section', 'columnBreak', 'section']);
  });

  it('ignores print settings and comments without warning', () => {
    const s = song(
      '{+pdf.chorus.recall.quote: true}',
      '{+diagrams.show: user}',
      '{new_page}',
      '{textsize: 12}',
      '{genre: Folk}',
      '# a source comment',
    );
    expect(s.warnings).toEqual([]);
    expect(s.blocks).toEqual([]);
  });

  it('warns about directives it does not understand, with the line number', () => {
    const s = song('{title: x}', '{zoom-iphone: 2}');
    expect(s.warnings).toEqual([
      { line: 2, code: 'unsupported', directive: 'zoom-iphone' },
    ]);
  });

  it('warns about unbalanced environments', () => {
    expect(song('{eov}').warnings[0]?.code).toBe('endWithoutStart');
    expect(song('{sov}', 'a').warnings[0]?.code).toBe('sectionNeverClosed');
    expect(song('{sov}', 'a', '{eoc}').warnings[0]?.code).toBe('endMismatch');
  });

  it('refuses a chord a diagram could not draw, and keeps the later of two definitions', () => {
    const s = song(
      '{define: G frets 3}',
      '{define: D frets x x 0 2 3 -2}',
      '{define: E frets 0 2 2 1 0 9}',
      '{define: A frets x 0 2 2 2 0}',
      '{define: A frets x 0 2 2 2 2}',
    );
    expect(s.warnings).toEqual([
      { line: 1, code: 'chordBadFrets', chord: 'G' },
      { line: 2, code: 'chordBadFrets', chord: 'D' },
      { line: 3, code: 'chordBadFrets', chord: 'E' },
    ]);
    expect(s.definitions.map((d) => [d.name, d.frets.at(-1)])).toEqual([['A', 2]]);
  });

  it('gives each warning the values its message needs', () => {
    expect(
      song('{capo: druhý}', '{define: Am}', '{define:}', '{sov}', '{sov}').warnings,
    ).toEqual([
      { line: 1, code: 'capoNotNumber', value: 'druhý' },
      { line: 2, code: 'chordNoFrets', chord: 'Am' },
      { line: 3, code: 'chordNoName' },
      { line: 5, code: 'startInsideSection', directive: 'start_of_verse' },
      { line: 5, code: 'sectionNeverClosed' },
    ]);
  });

  it('keeps tab sections verbatim', () => {
    const s = song('{sot}', 'e|--0--|', '', '{eot}');
    expect(s.blocks[0]).toMatchObject({
      kind: 'tab',
      lines: [
        { type: 'tab', text: 'e|--0--|' },
        { type: 'tab', text: '' },
      ],
    });
  });

  it('accepts CRLF line endings and a byte-order mark', () => {
    const s = parseSong('﻿{title:x}\r\n[A]a\r\n');
    expect(s.meta.title).toBe('x');
    expect(s.blocks).toHaveLength(1);
  });

  describe('note system', () => {
    it('is german when the song uses H', () => {
      expect(song('[H7]a').noteSystem).toBe('german');
      expect(song('{key: H}').noteSystem).toBe('german');
      expect(song('[A/H]a').noteSystem).toBe('german');
    });

    it('is common otherwise', () => {
      expect(song('[B7]a [E]b').noteSystem).toBe('common');
    });

    it('follows an explicit {+notes.system}', () => {
      expect(song('{+notes.system: german}', '[B]a').noteSystem).toBe('german');
    });
  });
});

describe('lyricsText', () => {
  it('returns the words without chords or comments', () => {
    const s = song('{c: Intro}', '[A] [D]', '', '[A]la [D]la', '{soc}', 'lo', '{eoc}');
    expect(lyricsText(s)).toBe('la la\nlo');
  });
});

describe('transposeSong', () => {
  it('moves every chord and the key, and drops the diagrams', () => {
    const s = song(
      '{key: A}',
      '{define: A frets x 0 2 2 2 0}',
      '{soc}',
      '[A]a [E]b',
      '{eoc}',
      '{chorus}',
    );
    const t = transposeSong(s, 2);
    expect(t.meta.key).toBe('B');
    expect(t.definitions).toEqual([]);
    expect(t.blocks[0]).toMatchObject({
      lines: [{ segments: [{ chord: 'B' }, { chord: 'F#' }] }],
    });
    expect(t.blocks[1]).toMatchObject({
      chorus: { lines: [{ segments: [{ chord: 'B' }, { chord: 'F#' }] }] },
    });
  });

  it('returns the song itself for whole octaves', () => {
    const s = song('[A]a');
    expect(transposeSong(s, 12)).toBe(s);
  });
});

describe('the seed songs', () => {
  const dir = join(import.meta.dirname, '../../../../seeds/songs');
  const files = readdirSync(dir).filter((f) => f.endsWith('.pro'));

  it.each(files)('%s parses without warnings', (file) => {
    const s = parseSong(readFileSync(join(dir, file), 'utf8'));
    expect(s.warnings).toEqual([]);
    expect(s.meta.title).toBeTruthy();
    expect(s.artist).toBeTruthy();
    expect(s.blocks.length).toBeGreaterThan(3);
  });
});
