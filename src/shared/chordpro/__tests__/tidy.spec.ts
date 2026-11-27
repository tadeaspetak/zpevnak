import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSong } from '../parse.ts';
import { tidySource } from '../tidy.ts';

const text = (...lines: string[]) => lines.join('\n');

/** What a reader sees of a song: the sheet and its header, not where it sits in the text. */
function sheet(source: string) {
  // The artist as shown, not which directive said it.
  const {
    warnings: _,
    meta: { artists: __, subtitle: ___, ...meta },
    ...song
  } = parseSong(source);
  return JSON.parse(
    JSON.stringify({ ...song, meta }, (key, value) =>
      key === 'source' || key === 'line' ? undefined : value,
    ),
  );
}

describe('tidySource', () => {
  it('leaves a tidy song as it is, and says nothing changed', () => {
    const source = text(
      '{title: Lala}',
      '{artist: Někdo}',
      '{key: Am}',
      '{tag: Koledy}',
      '',
      '{start_of_verse}',
      'la la [Am]la',
      '{end_of_verse}',
      '',
      '{chorus}',
    );
    expect(tidySource(source)).toEqual({ source, changes: [] });
  });

  it('takes out a printed page’s layout, and the blank line it leaves', () => {
    const tidied = tidySource(
      text(
        '{title: Lala}',
        '{columns: 2}',
        '{+diagrams.show: user}',
        '{+pdf.chorus.recall.quote: true}',
        '{textsize: 12}',
        '',
        '{start_of_verse}',
        'la [D]la',
        '{end_of_verse}',
        '',
        '{column_break}',
        '',
        '{start_of_verse}',
        'lo [G]lo',
        '{end_of_verse}',
      ),
    );
    expect(tidied).toEqual({
      source: text(
        '{title: Lala}',
        '',
        '{start_of_verse}',
        'la [D]la',
        '{end_of_verse}',
        '',
        '{start_of_verse}',
        'lo [G]lo',
        '{end_of_verse}',
      ),
      changes: ['layout'],
    });
  });

  it('keeps the one setting that changes how chords are read', () => {
    const source = text('{title: Lala}', '{+notes.system: german}', 'la [B]la');
    expect(tidySource(source).source).toBe(source);
  });

  it('takes out other apps’ settings and SongBook’s highlight marks', () => {
    expect(
      tidySource(
        text(
          '{title: Lala}',
          '{zoom-iphone: 1.04}',
          '{x_app_pedal: on}',
          'my [G]{soh}la{eoh} la',
        ),
      ),
    ).toEqual({ source: text('{title: Lala}', 'my [G]la la'), changes: ['otherApp'] });
  });

  it('writes short forms out', () => {
    expect(
      tidySource(text('{t: Lala}', '{k: G}', '{soc}', '[G]la', '{eoc}', '{c: 2x}')),
    ).toEqual({
      source: text(
        '{title: Lala}',
        '{key: G}',
        '{start_of_chorus}',
        '[G]la',
        '{end_of_chorus}',
        '{comment: 2x}',
      ),
      changes: ['shortForm'],
    });
  });

  it('writes every comment as a plain one', () => {
    expect(
      tidySource(text('{ci: pomalu}', '{comment_box: 2x}', '{highlight: stop}')),
    ).toEqual({
      source: text('{comment: pomalu}', '{comment: 2x}', '{comment: stop}'),
      changes: ['commentStyle'],
    });
  });

  it('drops a subtitle that repeats the artist, the same artists joined too', () => {
    expect(
      tidySource(text('{title: Lala}', '{subtitle: Někdo}', '{artist: Někdo}')).source,
    ).toBe(text('{title: Lala}', '{artist: Někdo}'));
    expect(
      tidySource(
        text('{title: Lala}', '{st: Někdo & Jiný}', '{artist: Někdo}', '{artist: Jiný}'),
      ).source,
    ).toBe(text('{title: Lala}', '{artist: Někdo}', '{artist: Jiný}'));
  });

  it('makes a subtitle standing for the artist the artist, and keeps a real one', () => {
    expect(tidySource(text('{title: Lala}', '{st: Někdo}'))).toEqual({
      source: text('{title: Lala}', '{artist: Někdo}'),
      changes: ['shortForm', 'subtitle'],
    });
    const real = text('{title: Lala}', '{subtitle: z filmu Lolo}', '{artist: Někdo}');
    expect(tidySource(real).source).toBe(real);
  });

  it('gives meta, genre, a length and a metronome their own directives', () => {
    expect(
      tidySource(
        text(
          '{meta: year 1999}',
          '{meta: tag Koledy}',
          '{genre: Folk}',
          '{time: 3:05}',
          '{metronome: 100}',
        ),
      ),
    ).toEqual({
      source: text(
        '{year: 1999}',
        '{tag: Koledy}',
        '{tag: Folk}',
        '{duration: 3:05}',
        '{tempo: 100}',
      ),
      changes: ['meta', 'genre', 'duration', 'tempo'],
    });
    expect(tidySource(text('{tempo: 90}', '{metronome: 100}')).source).toBe(
      '{tempo: 90}',
    );
    expect(tidySource('{time: 3/4}').source).toBe('{time: 3/4}');
  });

  it('drops labels that only say what the section is, and keeps the rest', () => {
    expect(
      tidySource(
        text(
          '{start_of_verse: 1}',
          '{start_of_verse: Verse 2}',
          '{start_of_verse label="Sloka 3."}',
          '{start_of_chorus: Chorus}',
          '{chorus: Ref.}',
        ),
      ),
    ).toEqual({
      source: text(
        '{start_of_verse}',
        '{start_of_verse}',
        '{start_of_verse}',
        '{start_of_chorus}',
        '{chorus}',
      ),
      changes: ['sectionLabel'],
    });
    // Two choruses told apart, an English bridge the sheet wouldn't name: words, not shape.
    const kept = text(
      '{start_of_chorus: Refrén 2}',
      '{start_of_bridge: Bridge}',
      '{start_of_intro: Předehra}',
    );
    expect(tidySource(kept).source).toBe(kept);
  });

  it('takes markup out of the lyrics, not out of a tab', () => {
    expect(tidySource(text('la <b>la</b> [D]<span color="red">lo</span> <3'))).toEqual({
      source: 'la la [D]lo <3',
      changes: ['markup'],
    });
    const tab = text('{start_of_tab}', 'e|--<b>--|', '{end_of_tab}');
    expect(tidySource(tab).source).toBe(tab);
  });

  it('writes directives with one space after the colon, unindented, in small letters', () => {
    expect(tidySource(text('{tag:- Pop -}', '  {Key: G}', '{start_of_verse }'))).toEqual({
      source: text('{tag: - Pop -}', '{key: G}', '{start_of_verse}'),
      changes: ['writing'],
    });
  });

  it('leaves the blanks of a song still being written', () => {
    const source = text(
      '{title: }',
      '{artist: }',
      '{key: }',
      '',
      '{start_of_verse}',
      'la',
      '{end_of_verse}',
    );
    expect(tidySource(source).changes).toEqual([]);
  });

  it('leaves what it doesn’t know, comments in the source and line ends as they are', () => {
    const source = text(
      '{title: Lala}',
      '# pro mě',
      '{solo: Eb C}',
      '{define-ukulele: C frets 0 0 0 3}',
    );
    expect(tidySource(source).source).toBe(source);
    expect(tidySource('{t: Lala}\r\nla la').source).toBe('{title: Lala}\r\nla la');
  });

  it('is done in one go: a tidy song stays tidy', () => {
    const once = tidySource(
      text(
        '{t: Lala}',
        '{st: Někdo}',
        '{columns: 2}',
        '',
        '{soc: Ref}',
        'la',
        '{eoc}',
        '',
        '{colb}',
        '',
        '{c: konec}',
      ),
    ).source;
    expect(tidySource(once)).toEqual({ source: once, changes: [] });
  });

  it('never changes what the reader sees', () => {
    const source = text(
      '{t: Lala}',
      '{st: Někdo}',
      '{k: Am}',
      '{meta: tag Koledy}',
      '{columns: 2}',
      '{define: Am7 base-fret 1 frets x 0 2 0 1 0}',
      '',
      '{sov}',
      '  la la [Am7]la',
      '{eov}',
      '{colb}',
      '{soc}',
      'lo [C]lo',
      '{eoc}',
      '{ci: pomalu}',
      '{chorus}',
    );
    expect(sheet(tidySource(source).source)).toEqual(sheet(source));
  });

  it('finds the seed songs tidy', () => {
    const dir = join(import.meta.dirname, '../../../../seeds/songs');
    for (const file of readdirSync(dir)) {
      expect(tidySource(readFileSync(join(dir, file), 'utf8')).changes, file).toEqual([]);
    }
  });
});
