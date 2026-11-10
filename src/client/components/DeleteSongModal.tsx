import { Loader, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router';
import { dropSong, syncCatalog } from '../data/catalog.ts';
import type { SongRecord } from '../data/store.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';
import { ConfirmModal } from './ConfirmModal.tsx';

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
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      title={t('song.delete')}
      confirmLabel={t('common.delete')}
      onConfirm={() => remove.mutate({ id: song.id })}
      loading={remove.isPending}
      disabled={impact.isLoading}
      error={impact.error ?? remove.error}
    >
      <Text>{t('song.deleteConfirm', { title: song.title })}</Text>
      {impact.isLoading ? (
        <Loader size="xs" />
      ) : (
        impact.data &&
        impact.data.playlists > 0 && (
          <Text fw={600}>{t('song.deleteImpact', { count: impact.data.playlists })}</Text>
        )
      )}
    </ConfirmModal>
  );
}
