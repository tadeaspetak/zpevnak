import { fold, slugify } from '../text.ts';
import { isHeaderLine, readTagLine } from './parse.ts';

/**
 * What makes two tags the same tag: "Vánoční", "vánoční" and "VANOCNI" are one. Also the tag's
 * part of its page's address. A tag with no letters a slug can keep is told apart by its folded
 * text instead.
 */
export function tagKey(tag: string): string {
  return slugify(tag) || fold(tag).trim().replace(/\s+/g, ' ');
}

/** The song's tags as its text states them, each once (the first spelling counts). */
export function tagsIn(source: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const line of source.split(/\r\n|\r|\n/)) {
    const tag = readTagLine(line);
    if (tag && !seen.has(tagKey(tag))) {
      seen.add(tagKey(tag));
      tags.push(tag);
    }
  }
  return tags;
}

/**
 * The source with exactly `tags` as its tags, changed as little as possible: a tag kept keeps its
 * line (respelt if `tags` spells it differently), a tag dropped loses its line, and a new tag
 * gets a `{tag: …}` line after the song's last tag, or else at the end of its header.
 */
export function setTags(source: string, tags: string[]): string {
  const wanted = new Map<string, string>();
  for (const tag of tags.map((t) => t.trim()).filter(Boolean)) {
    if (!wanted.has(tagKey(tag))) {
      wanted.set(tagKey(tag), tag);
    }
  }

  const newline = /\r\n/.test(source) ? '\r\n' : '\n';
  const kept = new Set<string>();
  const lines: string[] = [];
  let insertAt: number | null = null;
  let headerEnd = 0;
  let inHeader = true;
  for (const line of source.split(/\r\n|\r|\n/)) {
    const tag = readTagLine(line);
    if (tag !== null) {
      const key = tagKey(tag);
      const spelling = wanted.get(key);
      if (spelling !== undefined && !kept.has(key)) {
        kept.add(key);
        lines.push(spelling === tag ? line : `{tag: ${spelling}}`);
        insertAt = lines.length;
      }
      continue;
    }
    lines.push(line);
    if (inHeader) {
      if (isHeaderLine(line)) {
        headerEnd = lines.length;
      } else if (
        line.trim() !== '' &&
        !line.trim().startsWith('#') &&
        !line.trim().startsWith('{')
      ) {
        // The first line of the song itself: the header is over.
        inHeader = false;
      }
    }
  }

  const added = [...wanted]
    .filter(([key]) => !kept.has(key))
    .map(([, tag]) => `{tag: ${tag}}`);
  lines.splice(insertAt ?? headerEnd, 0, ...added);
  return lines.join(newline);
}

export type Tag = {
  key: string;
  /** The spelling most songs use; between equals, the first in `compare`'s order. */
  name: string;
  songIds: number[];
};

/** Every tag `songs` carry, A–Z in the reader's order, with the songs that carry each. */
export function gatherTags(
  songs: Iterable<{ id: number; tags: string[] }>,
  compare: (a: string, b: string) => number,
): Tag[] {
  type Gathered = { spellings: Map<string, number>; songIds: Set<number> };
  const byKey = new Map<string, Gathered>();
  for (const song of songs) {
    for (const tag of song.tags) {
      const key = tagKey(tag);
      const entry: Gathered = byKey.get(key) ?? {
        spellings: new Map(),
        songIds: new Set(),
      };
      byKey.set(key, entry);
      entry.spellings.set(tag, (entry.spellings.get(tag) ?? 0) + 1);
      entry.songIds.add(song.id);
    }
  }
  return [...byKey]
    .map(([key, { spellings, songIds }]) => ({
      key,
      name: mostUsed(spellings, compare),
      songIds: [...songIds],
    }))
    .sort((a, b) => compare(a.name, b.name));
}

function mostUsed(
  counts: Map<string, number>,
  compare: (a: string, b: string) => number,
) {
  let best: [string, number] = ['', 0];
  for (const [spelling, count] of counts) {
    if (count > best[1] || (count === best[1] && compare(spelling, best[0]) < 0)) {
      best = [spelling, count];
    }
  }
  return best[0];
}

/** `tags`, each written the way the catalog already writes it, so "vánoční" joins "Vánoční". */
export function spellAsKnown(tags: string[], known: Tag[]): string[] {
  const spelling = new Map(known.map((tag) => [tag.key, tag.name]));
  return tags.map((tag) => spelling.get(tagKey(tag)) ?? tag);
}
