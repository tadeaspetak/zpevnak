import { Container } from '@mantine/core';
import type { ReactNode } from 'react';
import { usePlayer } from '../data/session.ts';
import { PlaylistPill } from './PlaylistPill.tsx';
import { Footer } from './Footer.tsx';

/**
 * The reading column every non-song page sits in. With `pill`, the way back into the playlist
 * being played floats at the bottom (D32), and the page leaves room under its last row for it.
 */
export function Page({
  children,
  pill = false,
}: {
  children: ReactNode;
  pill?: boolean;
}) {
  const playing = usePlayer().session !== null;
  const withPill = pill && playing;
  return (
    <Container size="48rem" px="md" pt="md" pb={withPill ? '6rem' : 'md'}>
      {children}
      <Footer />
      {withPill && <PlaylistPill />}
    </Container>
  );
}
