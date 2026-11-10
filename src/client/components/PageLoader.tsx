import { Center, Loader } from '@mantine/core';

/**
 * Something on its way: centred in the screen (`full`, before a page has anything to show), or
 * in the page's column under its header.
 */
export function PageLoader({ full = false }: { full?: boolean }) {
  return full ? (
    <Center h="100dvh">
      <Loader />
    </Center>
  ) : (
    <Center py="xl">
      <Loader size="sm" />
    </Center>
  );
}
