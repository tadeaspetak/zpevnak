/** A box on the screen, in pixels from its top left. */
export type Box = { top: number; bottom: number; left: number; right: number };

/** A line of the song, laid out in columns: where its text is, and whether it had to wrap. */
export type TextLine = Box & { wrapped: boolean };

/**
 * Whether the pieces of one line (its words, or its text's line boxes) sit on more than one
 * row: the line wrapped. A pixel or two apart is the same row.
 */
export function lineWraps(tops: number[]): boolean {
  return tops.length > 1 && Math.max(...tops) - Math.min(...tops) > 2;
}

/**
 * How far a computed `transform` moves an element down (px): a bar slid out of the way is
 * `matrix(1, 0, 0, 1, 0, 60)`, or `matrix3d(…)` with it 14th; none moves it nowhere.
 */
export function translateYOf(transform: string): number {
  const values = /^matrix(3d)?\((.*)\)$/.exec(transform.trim());
  if (!values) {
    return 0;
  }
  const numbers = (values[2] ?? '').split(',').map(Number);
  const y = values[1] ? numbers[13] : numbers[5];
  return y !== undefined && Number.isFinite(y) ? y : 0;
}

/**
 * Whether a song laid out in columns can be read whole with its top at the top of the screen
 * (D88): no line has to wrap to fit its column, so the columns are wide enough at this text
 * size, whatever the screen (a tablet held upright too); and no text runs past the bottom of the
 * screen or under a bar fixed there. `lines` are the song's text, measured from the song's top;
 * `overlays` are the bars, on the screen. Only text counts: the empty end of a short line can sit
 * beside the playlist pill, and so can a column's last line, as long as no text goes under it.
 */
export function columnsFit(
  lines: TextLine[],
  overlays: Box[],
  screenHeight: number,
): boolean {
  return lines.every(
    (line) =>
      !line.wrapped &&
      line.bottom <= screenHeight &&
      overlays.every(
        (bar) =>
          line.bottom <= bar.top || line.right <= bar.left || line.left >= bar.right,
      ),
  );
}
