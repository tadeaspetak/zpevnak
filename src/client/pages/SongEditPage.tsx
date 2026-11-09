import { Button, Container, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ErrorText } from '../components/ErrorText.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { putSong, useCatalog } from '../data/catalog.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { ChordProEditor } from '../song/ChordProEditor.tsx';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';

/** /new: a new song, which goes to the review queue. */
export function NewSongPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { me } = useMe();
  const [source, setSource] = useState(() => t('editor.template'));
  const create = trpc.songs.create.useMutation({
    onSuccess: (song) => {
      putSong(song);
      notifications.show({ message: t('editor.submitted') });
      navigate(url.song(song));
    },
  });
  if (!me) {
    return <Navigate to={url.logIn(url.newSong())} replace />;
  }
  return (
    <>
      <PageHeader
        title={t('editor.newTitle')}
        backTo={url.home()}
        backLabel={t('nav.backHome')}
      />
      <Container size="80rem" px="md" py="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ source });
          }}
        >
          <ErrorText error={create.error} />
          <ChordProEditor value={source} onChange={setSource} />
          <Group justify="flex-end" mt="md">
            <Button type="submit" loading={create.isPending}>
              {t('editor.submit')}
            </Button>
          </Group>
        </form>
      </Container>
    </>
  );
}

/** /s/:id/edit: the author fixing their pending or rejected song, or an editor any song. */
export function EditSongPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const id = Number(useParams().id);
  const { songs, loaded } = useCatalog();
  const fromCatalog = songs.get(id);
  const fallback = trpc.songs.byId.useQuery({ id }, { enabled: loaded && !fromCatalog });
  const song = fromCatalog ?? fallback.data;
  const [source, setSource] = useState<string | null>(null);
  const update = trpc.songs.update.useMutation({
    onSuccess: (saved) => {
      putSong(saved);
      notifications.show({ message: t('common.saved') });
      navigate(url.song(saved));
    },
  });
  if (!song) {
    return null;
  }
  return (
    <>
      <PageHeader
        title={t('editor.editTitle')}
        backTo={url.song(song)}
        backLabel={t('nav.backTo', { name: song.title })}
      />
      <Container size="80rem" px="md" py="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ id, source: source ?? song.source });
          }}
        >
          <ErrorText error={update.error} />
          <ChordProEditor value={source ?? song.source} onChange={setSource} />
          <Group justify="flex-end" mt="md">
            <Button type="submit" loading={update.isPending} disabled={source === null}>
              {t('common.save')}
            </Button>
          </Group>
        </form>
      </Container>
    </>
  );
}
