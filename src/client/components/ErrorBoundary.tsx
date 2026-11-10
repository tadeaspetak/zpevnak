import { Button, Center, Stack, Text } from '@mantine/core';
import { Component, type ReactNode } from 'react';
import { useI18n } from '../i18n/index.tsx';

/**
 * Catches what would otherwise blank the whole screen mid-song: says so, and offers the one way
 * out, a reload (the songs are on the device, so it is quick and works offline).
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error('The app crashed:', error);
  }

  override render() {
    return this.state.failed ? <Crashed /> : this.props.children;
  }
}

function Crashed() {
  const { t } = useI18n();
  return (
    <Center h="100dvh" p="md">
      <Stack align="center">
        <Text ta="center">{t('error.crashed')}</Text>
        <Button onClick={() => window.location.reload()}>{t('error.reload')}</Button>
      </Stack>
    </Center>
  );
}
