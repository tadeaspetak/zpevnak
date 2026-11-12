import { Center, Loader } from '@mantine/core';
import { useI18n } from '../i18n/index.tsx';

/**
 * Something on its way: centred in the screen (`full`, before a page has anything to show), or
 * in the page's column under its header. Announced as a status, so a screen reader hears it too.
 */
export function PageLoader({ full = false }: { full?: boolean }) {
  const { t } = useI18n();
  const loader = (
    <Loader size={full ? 'md' : 'sm'} role="status" aria-label={t('common.loading')} />
  );
  return full ? <Center h="100dvh">{loader}</Center> : <Center py="xl">{loader}</Center>;
}
