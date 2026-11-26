import { describe, expect, it } from 'vitest';
import { reportLine } from '../notes.ts';
import type { NoteRecord } from '../store.ts';

const SOURCE = `{title: Píseň}

{start_of_verse}
la la [D]la
lu lu [A]lu
la la [D]la
{end_of_verse}`;

const at = (index: number, text: string) =>
  ({ line: { index, text } }) as unknown as NoteRecord;

describe('reportLine (D148)', () => {
  it('finds a report’s line in the text by its place, telling repeated lines apart', () => {
    expect(reportLine(SOURCE, at(0, 'la la la'))).toBe(4);
    expect(reportLine(SOURCE, at(2, 'la la la'))).toBe(6);
  });

  it('follows the line when the text above it changed', () => {
    const longer = SOURCE.replace('{start_of_verse}', '{start_of_verse}\nnový řádek');
    expect(reportLine(longer, at(1, 'lu lu lu'))).toBe(6);
  });

  it('has none for a report on the whole song', () => {
    expect(reportLine(SOURCE, { line: null } as NoteRecord)).toBeNull();
  });
});
