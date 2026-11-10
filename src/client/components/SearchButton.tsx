import { IconSearch } from '@tabler/icons-react';
import { openSearch } from '../data/omnibox.ts';
import { useI18n } from '../i18n/index.tsx';
import { IconButton } from './IconButton.tsx';

/** Opens the search over the current page (D30): last icon at top right, on every page. */
export function SearchButton({ size = 'lg' }: { size?: 'lg' | 'xl' }) {
  const { t } = useI18n();
  return (
    <IconButton
      label={t('home.searchLabel')}
      size={size}
      onClick={openSearch}
      aria-haspopup="dialog"
    >
      <IconSearch size={size === 'xl' ? 22 : 20} />
    </IconButton>
  );
}
