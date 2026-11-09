/** How to reach the app's author. */

export const REPOSITORY = 'https://github.com/tadeaspetak/zpevnak';

// Split, so the address never sits whole in the shipped JavaScript. The page renders the
// link in the browser, where only a scraper that runs JavaScript sees it.
const contactAddress = () => ['tadeaspetak', 'gmail.com'].join('@');

/**
 * A mailto: link to the author. Spaces are %20, not +: mail apps take a + literally, and the
 * subject would read "Chyba+v+písničce".
 */
export function mailtoAuthor(subject: string, body = ''): string {
  const query = new URLSearchParams({ subject, body }).toString().replace(/\+/g, '%20');
  return `mailto:${contactAddress()}?${query}`;
}
