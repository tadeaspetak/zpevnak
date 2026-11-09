import { ActionIcon, Group, Title, Tooltip } from '@mantine/core';
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
  actions?: ReactNode;
};

/** The one header style for every page that isn't home or a song. */
export function PageHeader({ title, backTo, backLabel, actions }: Props) {
  return (
    <header className={classes.header}>
      <Group gap="xs" wrap="nowrap" className={classes.inner}>
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
          <SearchButton />
        </Group>
      </Group>
    </header>
  );
}
