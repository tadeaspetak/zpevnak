import { Alert, Button, Group, Text } from '@mantine/core';
import {
  IconAlertTriangle,
  IconChecklist,
  IconInfoCircle,
  IconPencil,
} from '@tabler/icons-react';
import { Link } from 'react-router';
import type { SongRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';
import classes from './SongStatusBanner.module.css';

/**
 * A song's state, at the top of the song, in two strengths (D82): nobody has checked it yet is a
 * quiet line; rejected is a red banner, with the reason for its author and editors, and "waiting
 * to be fixed" for everyone else. A verified song shows nothing. An editor gets from an unchecked
 * song straight to its review (D121).
 */
export function SongStatusBanner({
  song,
  fixTo,
  reviewTo,
  inForm = false,
}: {
  song: SongRecord;
  /** Where the viewer can fix a rejected song, if they may. */
  fixTo?: string;
  /** Where the viewer can review a pending song, if they may. */
  reviewTo?: string;
  /** Inside a form's column, rather than above a song. */
  inForm?: boolean;
}) {
  const { t } = useI18n();
  const rejection = song.rejection;
  // "Other" says nothing by itself: the editor's note is the reason.
  const noteIsReason = rejection?.reason === 'other' && Boolean(rejection.note);
  if (song.status === 'pending') {
    return (
      <Alert icon={<IconInfoCircle size={18} />} className={classes.quiet}>
        <Group justify="space-between" gap="xs">
          <Text size="sm">{t('song.unverifiedNote')}</Text>
          {reviewTo && (
            <Button
              component={Link}
              to={reviewTo}
              size="xs"
              variant="default"
              leftSection={<IconChecklist size={14} />}
            >
              {t('song.review')}
            </Button>
          )}
        </Group>
      </Alert>
    );
  }
  if (song.status === 'rejected') {
    return (
      <Alert
        color="red"
        icon={<IconAlertTriangle size={20} />}
        className={inForm ? undefined : classes.banner}
        title={
          rejection
            ? noteIsReason
              ? t('common.rejected')
              : t('song.rejectedNote', { reason: t(`reason.${rejection.reason}`) })
            : undefined
        }
      >
        {rejection ? (
          <>
            {rejection.note && <Text size="sm">{rejection.note}</Text>}
            <Text size="sm">{t('song.rejectedFix')}</Text>
            {fixTo && (
              <Button
                component={Link}
                to={fixTo}
                size="sm"
                mt="xs"
                leftSection={<IconPencil size={16} />}
              >
                {t('song.fix')}
              </Button>
            )}
          </>
        ) : (
          <Text size="sm">{t('song.rejectedWaiting')}</Text>
        )}
      </Alert>
    );
  }
  return null;
}
