/**
 * How far a page-turner's PageDown scrolls (D148): to the first line not wholly on screen,
 * which then starts at the top, chords and all, so nothing is read twice and no line is cut.
 * `lines` are the song's lines as the screen has them (`getBoundingClientRect`), in order.
 * A screenful less a little when no line is cut, or the cut one starts too near the top to
 * move on by (a line taller than the screen): the reader always gets further.
 */
export function pageDownBy(
  lines: { top: number; bottom: number }[],
  height: number,
): number {
  const margin = 8;
  const cut = lines.find((line) => line.bottom > height);
  if (cut && cut.top > height * 0.25) {
    return cut.top - margin;
  }
  return height * 0.8;
}
