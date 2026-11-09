import { Button, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router';
import { dropSong, syncCatalog } from '../data/catalog.ts';
import type { SongRecord } from '../data/store.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';
import { ErrorText } from './ErrorText.tsx';

/** Who may delete a song (D78): editors any; its author until it is approved. */
export function useCanDelete(song: SongRecord | undefined): boolean {
  const { me, isEditor } = useMe();
  if (!song || !me?.emailVerified) {
    return false;
  }
  return isEditor || (song.createdBy === me.id && song.status !== 'verified');
}

/**
 * Deletes a song for good, after saying how many playlists lose it: the one change to people's
 * playlists that isn't theirs (D78). Afterwards, `then` (the overview by default).
 */
export function DeleteSongModal({
  song,
  opened,
  onClose,
  then = url.home(),
}: {
  song: SongRecord;
  opened: boolean;
  onClose: () => void;
  then?: string;
}) {
  const { t } = useI18n();
  const { me } = useMe();
  const navigate = useNavigate();
  const impact = trpc.songs.deleteImpact.useQuery({ id: song.id }, { enabled: opened });
  const remove = trpc.songs.delete.useMutation({
    onSuccess: () => {
      dropSong(song.id);
      // Its playlists changed: fetch them as they are now.
      void syncCatalog(me?.id ?? null);
      notifications.show({ message: t('song.deleted') });
      onClose();
      navigate(then, { replace: true });
    },
  });
  return (
    <Modal opened={opened} onClose={onClose} title={t('song.delete')}>
      <Stack>
        <Text>{t('song.deleteConfirm', { title: song.title })}</Text>
        {impact.isLoading ? (
          <Loader size="xs" />
        ) : (
          impact.data &&
          impact.data.playlists > 0 && (
            <Text fw={600}>
              {t('song.deleteImpact', { count: impact.data.playlists })}
            </Text>
          )
        )}
        <ErrorText error={impact.error ?? remove.error} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            color="red"
            loading={remove.isPending}
            disabled={impact.isLoading}
            onClick={() => remove.mutate({ id: song.id })}
          >
            {t('common.delete')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
