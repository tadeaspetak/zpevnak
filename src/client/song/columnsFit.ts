/** A box on the screen, in pixels from its top left. */
export type Box = { top: number; bottom: number; left: number; right: number };

/**
 * Whether a song laid out in columns can be read whole with its top at the top of the screen:
 * no text runs past the bottom of the screen or under a bar fixed there (D88). `lines` are the
 * song's text boxes, measured from the song's top; `overlays` are the bars, on the screen.
 * Only text counts: the empty end of a short line can sit beside the playlist pill, and so can
 * a column's last line, as long as no text goes under it.
 */
export function columnsFit(lines: Box[], overlays: Box[], screenHeight: number): boolean {
  return lines.every(
    (line) =>
      line.bottom <= screenHeight &&
      overlays.every(
        (bar) =>
          line.bottom <= bar.top || line.right <= bar.left || line.left >= bar.right,
      ),
  );
}
