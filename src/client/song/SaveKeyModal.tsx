import { Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { transposeSource } from '#shared/chordpro/transpose.ts';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import { putSong } from '../data/catalog.ts';
import { usePrefs } from '../data/prefs.ts';
import type { SongRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';

/**
 * Writes the song in the key it is transposed to, for everyone (D119): its text is rewritten,
 * so the key a player picked becomes the song's own. Saved like any edit, as a version.
 */
export function SaveKeyModal({
  song,
  semitones,
  shownKey,
  hasDiagrams,
  opened,
  onClose,
}: {
  song: SongRecord;
  semitones: number;
  /** The key it is transposed to; null for a song that names none. */
  shownKey: string | null;
  hasDiagrams: boolean;
  opened: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const prefs = usePrefs();
  const save = trpc.songs.update.useMutation({
    onSuccess: (saved) => {
      putSong(saved);
      // The text is in that key now: nothing left to transpose here.
      prefs.setTranspose(song.id, 0, null);
      notifications.show({
        message: shownKey
          ? t('song.keySaved', { key: shownKey })
          : t('song.transposedSaved'),
      });
      onClose();
    },
  });
  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      title={shownKey ? t('song.saveKey', { key: shownKey }) : t('song.saveTransposed')}
      confirmLabel={t('common.save')}
      danger={false}
      onConfirm={() =>
        save.mutate({
          id: song.id,
          source: transposeSource(song.source, semitones),
          seenAt: song.updatedAt,
        })
      }
      loading={save.isPending}
      error={save.error}
    >
      <Text>{t('song.saveKeyBody')}</Text>
      {hasDiagrams && <Text>{t('song.saveKeyDiagrams')}</Text>}
    </ConfirmModal>
  );
}
