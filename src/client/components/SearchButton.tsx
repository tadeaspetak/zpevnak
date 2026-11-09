import { ActionIcon, Tooltip } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { openSearch } from '../data/omnibox.ts';
import { useI18n } from '../i18n/index.tsx';

/** Opens the search over the current page (D30): last icon at top right, on every page. */
export function SearchButton({ size = 'lg' }: { size?: 'lg' | 'xl' }) {
  const { t } = useI18n();
  return (
    <Tooltip label={t('home.searchLabel')}>
      <ActionIcon
        variant="subtle"
        color="gray"
        size={size}
        onClick={openSearch}
        aria-label={t('home.searchLabel')}
        aria-haspopup="dialog"
      >
        <IconSearch size={size === 'xl' ? 22 : 20} />
      </ActionIcon>
    </Tooltip>
  );
}
