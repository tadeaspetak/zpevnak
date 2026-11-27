import { useMemo } from 'react';
import { gatherTags, type Tag } from '#shared/chordpro/tags.ts';
import { inSearch } from '#shared/songs.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { useCatalog } from './catalog.ts';

/**
 * Every artist of the songs the viewer can find, A–Z, each as most songs spell it (D152).
 * Gathered as tags are: one artist is every spelling that differs only in capitals and accents.
 */
export function useArtists(): Tag[] {
  const { songs } = useCatalog();
  const viewerId = useMe().me?.id ?? null;
  const { compare } = useI18n();
  return useMemo(
    () =>
      gatherTags(
        [...songs.values()]
          .filter((s) => inSearch(s, viewerId))
          .map((s) => ({ id: s.id, tags: s.artist ? [s.artist] : [] })),
        compare,
      ),
    [songs, viewerId, compare],
  );
}
