/** Lowercase, without diacritics: "Šlapej dál" → "slapej dal". For search and slugs. */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** "Lajla tov (Dobrou noc)" → "lajla-tov-dobrou-noc". */
export function slugify(text: string): string {
  // Cut before trimming, so a cut never leaves a dash at the end.
  return fold(text)
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80)
    .replace(/^-+|-+$/g, '');
}
