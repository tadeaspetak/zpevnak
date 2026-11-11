/**
 * After the focused control went away with its row (a removed song or person), focus the first
 * control left in `within` instead of letting it fall to the page, where a keyboard or a screen
 * reader would start over from the top.
 */
export function refocusWithin(within: HTMLElement | null) {
  requestAnimationFrame(() => {
    if (within && (!document.activeElement || document.activeElement === document.body)) {
      within
        .querySelector<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')
        ?.focus();
    }
  });
}
