import { Text } from '@mantine/core';
import { useMemo } from 'react';
import { useParams } from 'react-router';
import { ListSection } from '../components/ListSection.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { PageLoader } from '../components/PageLoader.tsx';
import { SongRow } from '../components/SongRow.tsx';
import { useCatalog } from '../data/catalog.ts';
import { sortByTitle } from '../data/search.ts';
import { useTags } from '../data/tags.ts';
import { useOnline } from '../hooks/useOnline.ts';
import { useI18n } from '../i18n/index.tsx';
import { url } from '#shared/urls.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

/** Every song the viewer can find with one tag, A–Z (D118). */
export function TagPage() {
  const { t, tn, compare } = useI18n();
  const { tagKey } = useParams();
  const { songs, loaded, synced } = useCatalog();
  const online = useOnline();
  const tag = useTags().find((x) => x.key === tagKey);
  const list = useMemo(
    () => sortByTitle(tag?.songIds.flatMap((id) => songs.get(id) ?? []) ?? [], compare),
    [tag, songs, compare],
  );

  if (!loaded || (!synced && songs.size === 0 && online)) {
    return <PageLoader full />;
  }
  if (!tag) {
    return <NotFoundPage />;
  }
  const backHere = { backTo: url.tag(tag.name), backName: tag.name };
  return (
    <>
      <PageHeader title={tag.name} backTo={url.home()} backLabel={t('nav.backHome')} />
      <Page pill>
        <ListSection
          title={t('tag.songs')}
          aside={
            <Text size="sm" c="dimmed">
              {tn('common.songs', list.length)}
            </Text>
          }
        >
          {list.map((song) => (
            <SongRow key={song.id} song={song} to={url.song(song)} linkState={backHere} />
          ))}
        </ListSection>
      </Page>
    </>
  );
}
