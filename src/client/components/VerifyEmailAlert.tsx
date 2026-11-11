import { Alert, Button, Stack, Text } from '@mantine/core';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { ErrorText } from './ErrorText.tsx';

/**
 * What an unconfirmed email holds back here (`message`), and the way out of it right where it
 * is said: the confirmation email again.
 */
export function VerifyEmailAlert({ message }: { message: string }) {
  const { t } = useI18n();
  const resend = trpc.auth.resendVerification.useMutation();
  return (
    <Alert color="yellow">
      <Stack gap="xs">
        <Text size="sm">{message}</Text>
        {resend.isSuccess ? (
          <Text size="sm" fw={600}>
            {t('account.resent')}
          </Text>
        ) : (
          <Button
            size="xs"
            variant="default"
            w="fit-content"
            loading={resend.isPending}
            onClick={() => resend.mutate()}
          >
            {t('account.resend')}
          </Button>
        )}
        <ErrorText error={resend.error} />
      </Stack>
    </Alert>
  );
}
