import { CloseButton, Modal, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { closeSearch, useSearchOpen } from '../data/omnibox.ts';
import { usePhone } from '../hooks/useBreakpoints.ts';
import { useI18n } from '../i18n/index.tsx';
import { SearchResults, useSearchResults } from './SearchResults.tsx';
import classes from './SearchOverlay.module.css';

/**
 * Search over whatever page is open: closing it leaves the player exactly where they were;
 * picking a result goes there, and that page's back arrow returns here.
 */
export function SearchOverlay() {
  const { t } = useI18n();
  const opened = useSearchOpen();
  const phone = usePhone();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const { items, selected, onKeyDown } = useSearchResults(query);

  // Picking a result navigates; the overlay closes behind it.
  useEffect(() => {
    closeSearch();
  }, [location.key]);

  return (
    <Modal
      opened={opened}
      onClose={closeSearch}
      onExitTransitionEnd={() => setQuery('')}
      fullScreen={phone}
      size="lg"
      yOffset="6dvh"
      withCloseButton={false}
      padding={0}
      classNames={{ body: classes.body }}
    >
      <div className={classes.bar}>
        <TextInput
          data-autofocus
          type="search"
          size="lg"
          variant="unstyled"
          className={classes.input}
          aria-label={t('home.searchLabel')}
          placeholder={t('home.searchPlaceholder')}
          leftSection={<IconSearch size={20} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
        />
        <CloseButton size="lg" onClick={closeSearch} aria-label={t('common.close')} />
      </div>
      {query.trim() && (
        <div className={classes.results}>
          <SearchResults query={query} items={items} selected={phone ? null : selected} />
        </div>
      )}
    </Modal>
  );
}
