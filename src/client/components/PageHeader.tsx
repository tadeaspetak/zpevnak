import { ActionIcon, Container, Divider, Group, Title, Tooltip } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import classes from './PageHeader.module.css';
import { SearchButton } from './SearchButton.tsx';

type Props = {
  title: ReactNode;
  /** Where "back" goes. Every page but home has one. */
  backTo: string;
  /** Where that is, in words: the tooltip and the accessible name ("Back to playlists"). */
  backLabel: string;
  /** This page's own actions. They sit left of a divider; search sits right of it (D30). */
  actions?: ReactNode;
  /** The page's own column width, so the header lines up with it: wide for the editors. */
  width?: '48rem' | '80rem';
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
}: Props) {
  return (
    <header className={classes.header}>
      <Container size={width} px="md">
        <Group gap="xs" wrap="nowrap">
          <Tooltip label={backLabel}>
            <ActionIcon
              component={Link}
              to={backTo}
              variant="subtle"
              color="gray"
              size="lg"
              aria-label={backLabel}
            >
              <IconArrowLeft size={22} />
            </ActionIcon>
          </Tooltip>
          <Title order={1} size="h3" className={classes.title}>
            {title}
          </Title>
          <Group gap={4} wrap="nowrap">
            {actions}
            {actions && <Divider orientation="vertical" my={6} mx={4} />}
            <SearchButton />
          </Group>
        </Group>
      </Container>
    </header>
  );
}
