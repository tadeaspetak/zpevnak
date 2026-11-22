import { useMemo } from 'react';
import { gatherTags, type Tag } from '#shared/chordpro/tags.ts';
import { inSearch } from '#shared/songs.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { useCatalog } from './catalog.ts';
import { songText } from './songText.ts';
import type { SongRecord } from './store.ts';

export type { Tag };

/** Every tag of the songs the viewer can find, A–Z. */
export function useTags(): Tag[] {
  const { songs } = useCatalog();
  const viewerId = useMe().me?.id ?? null;
  const { compare } = useI18n();
  return useMemo(
    () => catalogTags(songs.values(), viewerId, compare),
    [songs, viewerId, compare],
  );
}

/** Tags of the findable songs only: a rejected song is the author’s alone (D77). */
function catalogTags(
  songs: Iterable<SongRecord>,
  viewerId: number | null,
  compare: (a: string, b: string) => number,
): Tag[] {
  const findable = [...songs].filter((s) => inSearch(s, viewerId));
  return gatherTags(
    findable.map((s) => ({ id: s.id, tags: songText(s).tags })),
    compare,
  );
}
