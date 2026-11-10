import { Alert } from '@mantine/core';
import { useI18n } from '../i18n/index.tsx';

/** A server error, translated. Renders nothing without one. */
export function ErrorText({ error }: { error: unknown }) {
  const { tError } = useI18n();
  if (!error) {
    return null;
  }
  return (
    <Alert color="red" role="alert">
      {tError(error)}
    </Alert>
  );
}
