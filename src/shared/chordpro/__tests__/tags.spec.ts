import { describe, expect, it } from 'vitest';
import { parseSong } from '../parse.ts';
import { gatherTags, setTags, spellAsKnown, tagKey, tagsIn } from '../tags.ts';

const text = (...lines: string[]) => lines.join('\n');
const compare = (a: string, b: string) => a.localeCompare(b, 'cs');

describe('tagKey', () => {
  it('makes one tag of every spelling, case and accents aside', () => {
    expect(tagKey('Vánoční')).toBe('vanocni');
    expect(tagKey('VANOCNI')).toBe(tagKey('vánoční'));
    expect(tagKey('Lidové  písně')).toBe('lidove-pisne');
  });

  it('keeps a tag a slug would empty', () => {
    expect(tagKey('Ёлка')).toBe('елка');
    expect(tagKey('Ёлка')).not.toBe(tagKey('Ель'));
  });
});

describe('tagsIn', () => {
  it('reads both ways of writing a tag, as the parser does', () => {
    const source = text(
      '{title: Píseň}',
      '{tag: Vánoční}',
      '{tag Lidová}',
      '{meta: tag Táborák}',
      '{TAG:Kánon}',
      '{tag: }',
      'la la [D]la',
    );
    expect(tagsIn(source)).toEqual(['Vánoční', 'Lidová', 'Táborák', 'Kánon']);
    expect(tagsIn(source)).toEqual(parseSong(source).meta.tags);
  });

  it('counts a tag once, as first spelt', () => {
    expect(tagsIn(text('{tag: Vánoční}', '{tag: vánoční}'))).toEqual(['Vánoční']);
  });
});

describe('setTags', () => {
  const song = text('{title: Píseň}', '{artist: Někdo}', '{key: D}', '', 'la la [D]la');

  it('puts a new tag at the end of the header', () => {
    expect(setTags(song, ['Vánoční'])).toBe(
      text(
        '{title: Píseň}',
        '{artist: Někdo}',
        '{key: D}',
        '{tag: Vánoční}',
        '',
        'la la [D]la',
      ),
    );
  });

  it('puts it after the song’s last tag when it has some', () => {
    const tagged = text('{title: Píseň}', '{tag: Lidová}', '{key: D}', '', 'la la [D]la');
    expect(setTags(tagged, ['Lidová', 'Vánoční'])).toBe(
      text(
        '{title: Píseň}',
        '{tag: Lidová}',
        '{tag: Vánoční}',
        '{key: D}',
        '',
        'la la [D]la',
      ),
    );
  });

  it('drops the line of a tag taken away, whichever way it was written', () => {
    const tagged = text('{title: Píseň}', '{meta: tag Lidová}', '{tag Vánoční}', 'la la');
    expect(setTags(tagged, ['Vánoční'])).toBe(
      text('{title: Píseň}', '{tag Vánoční}', 'la la'),
    );
    expect(setTags(tagged, [])).toBe(text('{title: Píseň}', 'la la'));
  });

  it('respells a kept tag, and drops a second line of the same tag', () => {
    const tagged = text('{title: Píseň}', '{tag: vanocni}', '{tag: VÁNOČNÍ}', 'la la');
    expect(setTags(tagged, ['Vánoční'])).toBe(
      text('{title: Píseň}', '{tag: Vánoční}', 'la la'),
    );
  });

  it('ends the header at the song’s first line, not at a later directive', () => {
    const late = text('{title: Píseň}', 'la la', '{key: D}');
    expect(setTags(late, ['Vánoční'])).toBe(
      text('{title: Píseň}', '{tag: Vánoční}', 'la la', '{key: D}'),
    );
  });

  it('starts the text with the tag when there is no header', () => {
    expect(setTags('la la', ['Vánoční'])).toBe(text('{tag: Vánoční}', 'la la'));
  });

  it('keeps the text’s line endings, and changes nothing when the tags are the same', () => {
    const crlf = '{title: Píseň}\r\n{tag: Lidová}\r\nla la';
    expect(setTags(crlf, ['Lidová'])).toBe(crlf);
    expect(setTags(crlf, ['Lidová', 'Vánoční'])).toBe(
      '{title: Píseň}\r\n{tag: Lidová}\r\n{tag: Vánoční}\r\nla la',
    );
  });

  it('reads back what it wrote', () => {
    expect(tagsIn(setTags(song, ['Vánoční', ' Lidová ', 'vánoční']))).toEqual([
      'Vánoční',
      'Lidová',
    ]);
  });
});

describe('gatherTags', () => {
  it('collects each tag once with its songs, A–Z, under the spelling most songs use', () => {
    const tags = gatherTags(
      [
        { id: 1, tags: ['vánoční', 'Lidová'] },
        { id: 2, tags: ['Vánoční'] },
        { id: 3, tags: ['Vánoční'] },
      ],
      compare,
    );
    expect(tags).toEqual([
      { key: 'lidova', name: 'Lidová', songIds: [1] },
      { key: 'vanocni', name: 'Vánoční', songIds: [1, 2, 3] },
    ]);
  });

  it('settles a tie between spellings by the reader’s order', () => {
    const tags = gatherTags(
      [
        { id: 1, tags: ['vánoční'] },
        { id: 2, tags: ['Vánoční'] },
      ],
      compare,
    );
    expect(tags[0]?.name).toBe('vánoční');
  });
});

describe('spellAsKnown', () => {
  it('writes a known tag the catalog’s way, and leaves a new one as typed', () => {
    const known = [{ key: 'vanocni', name: 'Vánoční', songIds: [1] }];
    expect(spellAsKnown(['vanocni', 'Koledy'], known)).toEqual(['Vánoční', 'Koledy']);
  });
});
