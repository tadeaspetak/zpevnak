import { describe, expect, it } from 'vitest';
import { arrangeSong } from '../arrange.ts';
import { lyricsText, parseSong } from '../parse.ts';

const text = (...lines: string[]) => lines.join('\n');
const HEADER = ['{title: Lala}', '{artist: Někdo}', ''];

describe('arrangeSong', () => {
  it('leaves a song written this songbook’s way as it is', () => {
    const source = text(
      ...HEADER,
      '{start_of_verse}',
      'la [Am]la',
      '{end_of_verse}',
      '',
      '{start_of_chorus}',
      'lo [C]lo',
      '{end_of_chorus}',
      '',
      '{chorus}',
    );
    expect(arrangeSong(source)).toEqual({ source, changes: [] });
  });

  it('makes bare paragraphs verses and a headed one a chorus, sung again as {chorus}', () => {
    expect(
      arrangeSong(
        text(
          ...HEADER,
          'la [Am]la',
          'la la',
          '',
          '{c:REF}',
          'lo [C]lo',
          '',
          'li li',
          '',
          '{c:REF}',
        ),
      ),
    ).toEqual({
      source: text(
        ...HEADER,
        '{start_of_verse}',
        'la [Am]la',
        'la la',
        '{end_of_verse}',
        '',
        '{start_of_chorus}',
        'lo [C]lo',
        '{end_of_chorus}',
        '',
        '{start_of_verse}',
        'li li',
        '{end_of_verse}',
        '',
        '{chorus}',
      ),
      changes: ['sections'],
    });
  });

  it('takes the paragraph after a lone heading as its section, until there is a chorus', () => {
    expect(
      arrangeSong(text('{c: REF}', '', 'lo lo', '', '{c: REF}', '', 'li li')).source,
    ).toBe(
      text(
        '{start_of_chorus}',
        'lo lo',
        '{end_of_chorus}',
        '',
        '{chorus}',
        '',
        '{start_of_verse}',
        'li li',
        '{end_of_verse}',
      ),
    );
  });

  it('drops a heading the section after it says already, a number that tells two apart stays', () => {
    expect(arrangeSong(text('{c: REF}', '', '{soc}', 'lo', '{eoc}')).source).toBe(
      text('{soc}', 'lo', '{eoc}'),
    );
    expect(arrangeSong(text('{soc}', '{c: REF}', 'lo', '{eoc}')).source).toBe(
      text('{soc}', 'lo', '{eoc}'),
    );
    const two = text('{comment: Bridge 2}', '{start_of_bridge}', 'la', '{end_of_bridge}');
    expect(arrangeSong(two).source).toBe(two);
  });

  it('labels numbered choruses, and repeats only the last one', () => {
    expect(
      arrangeSong(
        text(
          '{c: REF 1}',
          'lo',
          '',
          '{c: REF 2}',
          'li',
          '',
          '{c: REF 2}',
          '',
          '{c: REF 1}',
        ),
      ).source,
    ).toBe(
      text(
        '{start_of_chorus: Refrén 1}',
        'lo',
        '{end_of_chorus}',
        '',
        '{start_of_chorus: Refrén 2}',
        'li',
        '{end_of_chorus}',
        '',
        '{chorus}',
        '',
        // No directive repeats an earlier chorus: the heading stays.
        '{c: REF 1}',
      ),
    );
  });

  it('names instrumental parts in Czech, keeps what else a heading says', () => {
    expect(
      arrangeSong(
        text(
          '{c: INTRO keys}',
          '[C] [G]',
          '',
          '{c: Mezihra}',
          '[Am]',
          '',
          '{c:verse 2x}',
          'la',
        ),
      ).source,
    ).toBe(
      text(
        '{start_of_intro: Předehra}',
        '{comment: keys}',
        '[C] [G]',
        '{end_of_intro}',
        '',
        '{start_of_interlude: Mezihra}',
        '[Am]',
        '{end_of_interlude}',
        '',
        '{start_of_verse}',
        '{comment: 2x}',
        'la',
        '{end_of_verse}',
      ),
    );
  });

  it('names a part of chords only by where it is in a sung song', () => {
    expect(
      arrangeSong(
        text('[C] [G]', '', 'la [C]la', '', '[Am] | [F]', '', 'lo lo', '', '[C]'),
      ).source,
    ).toBe(
      text(
        '{start_of_intro: Předehra}',
        '[C] [G]',
        '{end_of_intro}',
        '',
        '{start_of_verse}',
        'la [C]la',
        '{end_of_verse}',
        '',
        '{start_of_interlude: Mezihra}',
        '[Am] | [F]',
        '{end_of_interlude}',
        '',
        '{start_of_verse}',
        'lo lo',
        '{end_of_verse}',
        '',
        '{start_of_outro: Dohra}',
        '[C]',
        '{end_of_outro}',
      ),
    );
    // A band's chart, chords only, has nothing sung to place them by.
    const chart = text('{c: SLOKA}', '[A] [D]', '', '[E] [A]');
    expect(arrangeSong(arrangeSong(chart).source).source).toBe(
      text('{start_of_verse}', '[A] [D]', '{end_of_verse}', '', '[E] [A]'),
    );
  });

  it('leaves alone what it can’t be sure of', () => {
    const source = text(
      '{c: klavír, rocknroll}',
      '',
      '{c: verse 3 = 2}',
      '',
      '{c: R. Někdo}',
      '',
      '{c: REF}',
      '{c: REF}',
      '+ la la',
    );
    expect(arrangeSong(source)).toEqual({ source, changes: [] });
  });

  it('writes minor chords with m, not mi', () => {
    expect(
      arrangeSong(
        text('{key: Ami}', '', 'la [Ami]la [C#mi7]la [Hmi/F#]la [Amaj7]la [Amin]la'),
      ),
    ).toEqual({
      source: text(
        '{key: Am}',
        '',
        '{start_of_verse}',
        'la [Am]la [C#m7]la [Hm/F#]la [Amaj7]la [Amin]la',
        '{end_of_verse}',
      ),
      changes: ['sections', 'chords'],
    });
  });

  it('keeps the old songbook’s genres as tags, drops its statuses and the artist', () => {
    expect(
      arrangeSong(
        text(
          '{title: Lala}',
          '{subtitle: Někdo}',
          '{tag:- Pop -}',
          '{tag:- Zpěvník -}',
          '{tag:- !Dodělat -}',
          '{tag:- Po anglicku -}',
          '{tag:Někdo}',
          '{tag:Kapela}',
        ),
      ),
    ).toEqual({
      source: text('{title: Lala}', '{subtitle: Někdo}', '{tag: Pop}', '{tag:Kapela}'),
      changes: ['tags'],
    });
  });

  it('moves a capo from a comment into the header, unless there is one', () => {
    expect(
      arrangeSong(
        text('{title: Lala}', '{tag: Pop}', '{c:capo 3}', '', '{sov}', 'la', '{eov}'),
      ),
    ).toEqual({
      source: text(
        '{title: Lala}',
        '{tag: Pop}',
        '{capo: 3}',
        '',
        '{sov}',
        'la',
        '{eov}',
      ),
      changes: ['capo'],
    });
    const both = text('{capo: 2}', '{c: capo 3}');
    expect(arrangeSong(both).source).toBe(both);
  });

  it('takes a band’s running order off the title, not a number that is the title', () => {
    expect(arrangeSong('{t:08 Lala}').source).toBe('{title: Lala}');
    expect(arrangeSong('{title: 1 lala}').source).toBe('{title: 1 lala}');
  });

  it('closes a directive left open', () => {
    expect(arrangeSong(text('{key:Am', '{tag:Pop)'))).toEqual({
      source: text('{key:Am}', '{tag:Pop}'),
      changes: ['unclosed'],
    });
  });

  it('never changes the words, and is done in one go', () => {
    const source = text(
      '{t:03 Lala}',
      '{st:Někdo}',
      '{tag:- Folk -}',
      '{c:capo 2}',
      '',
      '{c:Intro}',
      '[Ami] [G]',
      '',
      'la [Ami]la la',
      'lo lo',
      '',
      '{c:REF}',
      'li [C]li',
      '',
      'le le',
      '',
      '{c:REF 2x}',
    );
    const once = arrangeSong(source).source;
    expect(lyricsText(parseSong(once))).toBe(lyricsText(parseSong(source)));
    expect(arrangeSong(once)).toEqual({ source: once, changes: [] });
  });
});
