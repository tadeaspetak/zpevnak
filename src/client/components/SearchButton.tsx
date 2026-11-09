import { ActionIcon, Tooltip } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { Link } from 'react-router';
import { useI18n } from '../i18n/index.tsx';
import { url } from '../urls.ts';

/** Straight to the song search from any page: the back arrow only climbs one level. */
export function SearchButton({ size = 'lg' }: { size?: 'lg' | 'xl' }) {
  const { t } = useI18n();
  return (
    <Tooltip label={t('home.searchLabel')}>
      <ActionIcon
        component={Link}
        to={url.search()}
        variant="subtle"
        color="gray"
        size={size}
        aria-label={t('home.searchLabel')}
      >
        <IconSearch size={size === 'xl' ? 22 : 20} />
      </ActionIcon>
    </Tooltip>
  );
}
