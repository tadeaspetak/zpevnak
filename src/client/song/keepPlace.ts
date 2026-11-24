/**
 * Keeping the reader's place while the text size changes (a pinch, the size buttons): the line
 * they were looking at stays where it was on the screen, however the song reflows around it,
 * into two columns or out of them. Held for a moment around the change, then let go.
 */

/** How long a held place lasts after the last change: the reflow, and columns settling. */
const HOLD_MS = 1000;

type Held = { line: Element; top: number; until: number };
let held: Held | null = null;
/** When this last scrolled the page itself: that scroll is no reader's (`isKeepingPlace`). */
let scrolledAt = 0;

/** Whether the page just scrolled to keep the place, not because the reader scrolled. */
export function isKeepingPlace(): boolean {
  return Date.now() - scrolledAt < 300;
}

/** Which of `lines` is at `y`: the one across it, else the first below it; -1 if none. */
export function lineAt(lines: { top: number; bottom: number }[], y: number): number {
  const across = lines.findIndex((line) => line.top <= y && line.bottom > y);
  return across >= 0 ? across : lines.findIndex((line) => line.top > y);
}

/** The song's lines on the page: not the copy measured for columns. */
function songLines(): Element[] {
  return [...document.querySelectorAll('article section > *')].filter(
    (el) => !el.closest('[inert]'),
  );
}

/**
 * Takes the line at (`x`, `y`) on the screen (in two columns, the one in the column there) as
 * the place to keep. Nothing to hold outside a song.
 */
export function holdPlace(x: number, y: number) {
  // Every browser has it; a test's DOM may not, and then the line is found by its height.
  const under = document.elementFromPoint?.(x, y)?.closest('article section > *');
  const lines = songLines();
  const line =
    under && lines.includes(under)
      ? under
      : lines[
          lineAt(
            lines.map((el) => el.getBoundingClientRect()),
            y,
          )
        ];
  held = line
    ? { line, top: line.getBoundingClientRect().top, until: Date.now() + HOLD_MS }
    : null;
}

/** Keeps holding the same line a moment longer (a pinch still going). */
export function extendHold() {
  if (held) {
    held.until = Date.now() + HOLD_MS;
  }
}

/** After a reflow: scrolls so the held line is back where it was. */
export function restorePlace() {
  if (!held || Date.now() > held.until || !held.line.isConnected) {
    held = null;
    return;
  }
  const moved = held.line.getBoundingClientRect().top - held.top;
  if (Math.abs(moved) > 1) {
    scrolledAt = Date.now();
    window.scrollBy(0, moved);
  }
}
