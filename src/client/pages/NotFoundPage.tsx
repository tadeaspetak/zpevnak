import { Button, Center, Stack, Title } from '@mantine/core';
import { Link } from 'react-router';
import { useI18n } from '../i18n/index.tsx';
import { url } from '../urls.ts';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <Center h="100dvh" p="md">
      <Stack align="center">
        <Title order={1} size="h3" ta="center">
          {t('notFound.title')}
        </Title>
        <Button component={Link} to={url.home()} variant="light">
          {t('notFound.home')}
        </Button>
      </Stack>
    </Center>
  );
}
