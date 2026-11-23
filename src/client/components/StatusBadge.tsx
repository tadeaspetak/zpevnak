import { Badge, Tooltip } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import type { SongStatus } from '#shared/validators/index.ts';
import { useI18n } from '../i18n/index.tsx';

/**
 * Says when a song isn't verified. Verified is the normal case and shows nothing. A private song
 * isn't reviewed at all: a lock says it is kept to a few people (D127), as a globe marks a public
 * playlist (D112).
 */
export function StatusBadge({ status }: { status: SongStatus }) {
  const { t } = useI18n();
  if (status === 'verified') {
    return null;
  }
  if (status === 'private') {
    return (
      <Tooltip label={t('songs.privateMark')}>
        <IconLock
          size={16}
          aria-label={t('songs.privateMark')}
          role="img"
          style={{ flexShrink: 0, color: 'var(--mantine-color-dimmed)' }}
        />
      </Tooltip>
    );
  }
  return (
    <Badge
      size="sm"
      // Unverified is neutral (the theme's default); rejected means something: red (D61).
      {...(status === 'rejected' ? { variant: 'outline', color: 'red' } : {})}
      style={{ flexShrink: 0 }}
    >
      {status === 'rejected' ? t('common.rejected') : t('common.unverified')}
    </Badge>
  );
}
