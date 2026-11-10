import { Button, Center, Container, Loader, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useRef } from 'react';
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';
import { ErrorText } from '../components/ErrorText.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { putPlaylist, putSong, useCatalog } from '../data/catalog.ts';
import { useDraft } from '../hooks/useDraft.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { ChordProEditor, type ChordProEditorHandle } from '../song/ChordProEditor.tsx';
import { SongStatusBanner } from '../song/SongStatusBanner.tsx';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';

/**
 * /new: a new song, which goes to the review queue. From a search that found nothing it starts
 * with that title, and from a playlist's song picker it goes into the playlist too.
 */
export function NewSongPage() {
  const { t, tError } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { me, known } = useMe();
  const [params] = useSearchParams();
  const { playlists } = useCatalog();
  const playlist = playlists.get(Number(params.get('playlist')));
  const template = t('editor.template', { songTitle: params.get('title') ?? '' });
  const draft = useDraft('new', template);
  const source = draft.source ?? template;
  const editor = useRef<ChordProEditorHandle>(null);
  const addToPlaylist = trpc.playlists.edit.useMutation();
  const create = trpc.songs.create.useMutation({
    onSuccess: async (song) => {
      putSong(song);
      draft.clear();
      if (playlist) {
        try {
          const updated = await addToPlaylist.mutateAsync({
            id: playlist.id,
            op: { type: 'add', songId: song.id },
          });
          putPlaylist(updated.id, updated);
          notifications.show({
            message: t('editor.submittedTo', { name: playlist.name }),
          });
          navigate(url.playlist(playlist));
          return;
        } catch (error) {
          // The song is saved all the same: say why it isn't in the playlist, and show it.
          notifications.show({ color: 'red', message: tError(error) });
        }
      } else {
        notifications.show({ message: t('editor.submitted') });
      }
      navigate(url.song(song));
    },
  });
  if (!me) {
    // Who's signed in may not be known yet on a cold load: wait rather than send them away.
    return known ? (
      <Navigate to={url.logIn(location.pathname + location.search)} replace />
    ) : (
      <Center h="100dvh">
        <Loader />
      </Center>
    );
  }
  return (
    <>
      <PageHeader
        width="80rem"
        title={t('editor.newTitle')}
        backTo={playlist ? url.playlist(playlist) : url.home()}
        backLabel={
          playlist ? t('nav.backTo', { name: playlist.name }) : t('nav.backHome')
        }
      />
      <Container size="80rem" px="md" pt="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (editor.current?.checkTitle() !== false) {
              create.mutate({ source });
            }
          }}
        >
          <Stack gap="sm">
            <ErrorText error={create.error} />
            <ChordProEditor
              ref={editor}
              value={source}
              onChange={draft.setSource}
              onDiscardDraft={draft.restored ? draft.clear : undefined}
              actions={
                <Button
                  type="submit"
                  loading={create.isPending || addToPlaylist.isPending}
                >
                  {t('editor.submit')}
                </Button>
              }
            />
          </Stack>
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
  const draft = useDraft(`edit:${id}`, song?.source);
  const editor = useRef<ChordProEditorHandle>(null);
  // Saving a rejected song sends it back to the queue (D81): the button says so.
  const resubmits = song?.status === 'rejected';
  const update = trpc.songs.update.useMutation({
    onSuccess: (saved) => {
      putSong(saved);
      draft.clear();
      notifications.show({
        message: resubmits ? t('editor.resubmitted') : t('common.saved'),
      });
      navigate(url.song(saved));
    },
  });
  if (!song) {
    return null;
  }
  const source = draft.source ?? song.source;
  return (
    <>
      <PageHeader
        width="80rem"
        title={t('editor.editTitle')}
        backTo={url.song(song)}
        backLabel={t('nav.backTo', { name: song.title })}
      />
      <Container size="80rem" px="md" pt="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (editor.current?.checkTitle() !== false) {
              update.mutate({ id, source });
            }
          }}
        >
          <Stack gap="sm">
            {resubmits && <SongStatusBanner song={song} inForm />}
            <ErrorText error={update.error} />
            <ChordProEditor
              ref={editor}
              value={source}
              onChange={draft.setSource}
              onDiscardDraft={draft.restored ? draft.clear : undefined}
              actions={
                <Button type="submit" loading={update.isPending} disabled={!draft.dirty}>
                  {resubmits ? t('editor.saveAndResubmit') : t('common.save')}
                </Button>
              }
            />
          </Stack>
        </form>
      </Container>
    </>
  );
}
