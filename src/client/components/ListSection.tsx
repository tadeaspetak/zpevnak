import { Group, Stack, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './ListSection.module.css';

/**
 * A titled group of rows. The title is a real heading, bold and set on a rule, so it reads as
 * structure and not as one more row.
 */
export function ListSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <Group justify="space-between" align="baseline" className={classes.head}>
        <Title order={2} fz="lg" fw={700}>
          {title}
        </Title>
        {aside}
      </Group>
      <Stack gap={0} mx="-md">
        {children}
      </Stack>
    </section>
  );
}
