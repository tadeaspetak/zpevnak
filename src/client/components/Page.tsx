import { Container } from '@mantine/core';
import type { ReactNode } from 'react';

/** The reading column every non-song page sits in. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <Container size="48rem" px="md" py="md">
      {children}
    </Container>
  );
}
