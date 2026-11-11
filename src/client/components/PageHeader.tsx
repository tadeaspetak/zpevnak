import { Box, Container, Divider, Group, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import type { ReactNode } from 'react';

import classes from './PageHeader.module.css';
import { SearchButton } from './SearchButton.tsx';
import { SettingsButton } from './SettingsButton.tsx';
import { IconButton } from './IconButton.tsx';

type Props = {
  title: ReactNode;
  /** Where "back" goes. Every page but home has one. */
  backTo: string;
  /** Where that is, in words: the tooltip and the accessible name ("Back to playlists"). */
  backLabel: string;
  /** This page's own actions. They sit left of a divider; settings and search right of it
   * (D30, D113). */
  actions?: ReactNode;
  /** The page's own column width, so the header lines up with it: wide for the editors. */
  width?: '48rem' | '80rem';
  /**
   * `page`: on a phone the title isn't in the header but the page's first line (the page shows
   * it), for a long name beside many icons.
   */
  titleOnPhone?: 'header' | 'page';
};

/**
 * The one header style for every page that isn't home or a song, in the same column as the
 * page's content (`Page`), so every page is equally wide.
 */
export function PageHeader({
  title,
  backTo,
  backLabel,
  actions,
  width = '48rem',
  titleOnPhone = 'header',
}: Props) {
  const onPage = titleOnPhone === 'page';
  return (
    <header className={classes.header}>
      <Container size={width} px="md">
        <Group gap="xs" wrap="nowrap">
          <IconButton label={backLabel} to={backTo}>
            <IconArrowLeft size={22} />
          </IconButton>
          <Title
            order={1}
            size="h3"
            className={classes.title}
            visibleFrom={onPage ? 'sm' : undefined}
          >
            {title}
          </Title>
          {onPage && <Box flex={1} hiddenFrom="sm" />}
          <Group gap={4} wrap="nowrap">
            {actions}
            {actions && <Divider orientation="vertical" my={6} mx={4} />}
            <SettingsButton />
            <SearchButton />
          </Group>
        </Group>
      </Container>
    </header>
  );
}
