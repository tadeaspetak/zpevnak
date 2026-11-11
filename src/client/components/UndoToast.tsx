import { Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { ErrorText } from './ErrorText.tsx';

/**
 * What one tap just did, and one tap to take it back (D87): "… · Beru zpátky", for 8 seconds.
 * At the bottom, so it never covers a dialog's title and close button. It outlives the page or
 * dialog that showed it, so `onUndo` must not need them.
 */
export function showUndoToast({
  id,
  message,
  onUndo,
}: {
  id: string;
  message: string;
  onUndo: () => Promise<void>;
}) {
  notifications.show({
    id,
    autoClose: 8000,
    position: 'bottom-center',
    message: (
      <UndoMessage
        message={message}
        onUndo={async () => {
          await onUndo();
          notifications.hide(id);
        }}
      />
    ),
  });
}

/** The message and its undo button, inside a toast or in a list (a just-removed row). */
export function UndoMessage({
  message,
  onUndo,
}: {
  message: string;
  onUndo: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text size="sm">{message}</Text>
        <Button
          size="xs"
          variant="default"
          style={{ flexShrink: 0 }}
          loading={pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            try {
              await onUndo();
            } catch (e) {
              setError(e);
              setPending(false);
            }
          }}
        >
          {t('common.undo')}
        </Button>
      </Group>
      <ErrorText error={error} />
    </Stack>
  );
}
