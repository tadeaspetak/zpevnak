import { describe, expect, it } from 'vitest';
import { addComment, commentText, removeComment, replaceComment } from '../comments.ts';
import { parseSong } from '../parse.ts';
import type { Line } from '../types.ts';

const SONG = `{title: Píseň}
{key: Am}
{tag: Lidová}
{define: Am base-fret 1 frets x 0 2 2 1 0}

{start_of_verse}
la la [Am]la
lu lu [C]lu
{end_of_verse}

{start_of_chorus}
na na [F]na
{end_of_chorus}

{chorus}`;

/** Every line of the parsed song, with its source line. */
const lines = (source: string): Line[] =>
  parseSong(source).blocks.flatMap((b) => (b.type === 'section' ? b.lines : []));

const commentsOf = (source: string) =>
  lines(source).flatMap((l) => (l.type === 'comment' ? [l.text] : []));

describe('song comments (D145)', () => {
  it('knows each line’s source line, as the comment goes after it', () => {
    expect(lines(SONG).map((l) => l.source)).toEqual([7, 8, 12]);
  });

  it('adds a comment after a line, inside its section, touching nothing else', () => {
    const changed = addComment(SONG, 7, 'pomalu');
    expect(changed.split('\n')).toEqual([
      ...SONG.split('\n').slice(0, 7),
      '{comment: pomalu}',
      ...SONG.split('\n').slice(7),
    ]);
    const verse = parseSong(changed).blocks[0];
    expect(verse?.type === 'section' && verse.lines.map((l) => l.type)).toEqual([
      'lyrics',
      'comment',
      'lyrics',
    ]);
  });

  it('adds one for the whole song at its head, after the header, before the first verse', () => {
    const changed = addComment(SONG, null, 'capo 2');
    expect(changed.split('\n').slice(3, 8)).toEqual([
      '{define: Am base-fret 1 frets x 0 2 2 1 0}',
      '',
      '{comment: capo 2}',
      '',
      '{start_of_verse}',
    ]);
    expect(commentsOf(changed)).toEqual(['capo 2']);
    expect(parseSong(changed).meta.title).toBe('Píseň');
  });

  it('puts a whole-song comment at the end of a song that has nothing else yet', () => {
    expect(addComment('{title: Píseň}', null, 'zatím nic')).toBe(
      '{title: Píseň}\n{comment: zatím nic}',
    );
  });

  it('keeps the song’s line ends', () => {
    const crlf = SONG.replace(/\n/g, '\r\n');
    const changed = addComment(crlf, 8, 'konec');
    expect(changed).toContain('lu lu [C]lu\r\n{comment: konec}\r\n{end_of_verse}');
    expect(changed).not.toMatch(/[^\r]\n/);
  });

  it('writes a comment on one line, whatever was typed', () => {
    expect(commentText('  dvakrát\n  pak   konec ')).toBe('dvakrát pak konec');
    expect(commentsOf(addComment(SONG, 7, 'a\nb'))).toEqual(['a b']);
  });

  it('changes a comment in place, keeping how it was written', () => {
    const source = SONG.replace('la la [Am]la', 'la la [Am]la\n{ci: pomalu}');
    const changed = replaceComment(source, 8, 'rychle');
    expect(changed.split('\n')[7]).toBe('{ci: rychle}');
    expect(lines(changed).find((l) => l.type === 'comment')).toMatchObject({
      text: 'rychle',
      style: 'italic',
    });
  });

  it('removes a comment, and the blank line one at the head came with', () => {
    expect(removeComment(addComment(SONG, 7, 'pomalu'), 8)).toBe(SONG);
    expect(removeComment(addComment(SONG, null, 'capo 2'), 6)).toBe(SONG);
  });

  it('refuses to change or remove a line that isn’t a comment, or to empty one', () => {
    expect(() => replaceComment(SONG, 7, 'x')).toThrow();
    expect(() => removeComment(SONG, 7)).toThrow();
    expect(() => replaceComment(addComment(SONG, 7, 'pomalu'), 8, '  ')).toThrow();
  });

  it('keeps a song’s old Mac line ends', () => {
    const cr = SONG.replace(/\n/g, '\r');
    expect(addComment(cr, 8, 'konec')).toContain('lu lu [C]lu\r{comment: konec}\r');
  });

  it('keeps the song’s own spacing around a comment it removes inside the song', () => {
    const spaced = SONG.replace('la la [Am]la\n', 'la la [Am]la\n\n{c: pauza}\n\n');
    expect(removeComment(spaced, 9)).toBe(
      SONG.replace('la la [Am]la\n', 'la la [Am]la\n\n\n'),
    );
  });
});
