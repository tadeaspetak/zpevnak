import { Alert, Text } from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import type { SongRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';
import classes from './SongStatusBanner.module.css';

/**
 * A song's state, at the top of the song, in two strengths (D82): nobody has checked it yet is a
 * quiet line; rejected is a red banner, with the reason for its author and editors, and "waiting
 * to be fixed" for everyone else. A verified song shows nothing.
 */
export function SongStatusBanner({ song }: { song: SongRecord }) {
  const { t } = useI18n();
  if (song.status === 'pending') {
    return (
      <Alert
        color="gray"
        variant="light"
        icon={<IconInfoCircle size={18} />}
        className={classes.quiet}
      >
        <Text size="sm">{t('song.unverifiedNote')}</Text>
      </Alert>
    );
  }
  if (song.status === 'rejected') {
    return (
      <Alert
        color="red"
        variant="light"
        icon={<IconAlertTriangle size={20} />}
        className={classes.banner}
        title={
          song.rejection
            ? t('song.rejectedNote', { reason: t(`reason.${song.rejection.reason}`) })
            : undefined
        }
      >
        {song.rejection ? (
          <>
            {song.rejection.note && <Text size="sm">{song.rejection.note}</Text>}
            <Text size="sm">{t('song.rejectedFix')}</Text>
          </>
        ) : (
          <Text size="sm">{t('song.rejectedWaiting')}</Text>
        )}
      </Alert>
    );
  }
  return null;
}
