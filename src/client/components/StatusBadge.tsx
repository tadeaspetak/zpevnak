import { Badge } from '@mantine/core';
import type { SongStatus } from '#shared/validators/index.ts';
import { useI18n } from '../i18n/index.tsx';

/** Says when a song isn't verified. Verified is the normal case and shows nothing. */
export function StatusBadge({ status }: { status: SongStatus }) {
  const { t } = useI18n();
  if (status === 'verified') {
    return null;
  }
  return (
    <Badge
      size="sm"
      variant="light"
      color={status === 'rejected' ? 'red' : 'gray'}
      style={{ flexShrink: 0 }}
    >
      {status === 'rejected' ? t('common.rejected') : t('common.unverified')}
    </Badge>
  );
}
