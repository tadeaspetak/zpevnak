import { Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { ErrorText } from './ErrorText.tsx';

/**
 * What one tap just did, and one tap to take it back (D87): "… · Beru zpátky", for 8 seconds.
 * At the bottom, so it never covers a dialog's title and close button. It outlives the page or
 * dialog that showed it, so `onUndo` and `onKept` must not need them.
 *
 * `onKept`: the toast closed without an undo. For a change only shown until then and sent to
 * the server now (a note deleted, D139), so an undo never has to rebuild what was lost.
 */
export function showUndoToast({
  id,
  message,
  onUndo,
  onKept,
}: {
  id: string;
  message: string;
  onUndo: () => Promise<void>;
  onKept?: () => void;
}) {
  let undone = false;
  notifications.show({
    id,
    autoClose: 8000,
    position: 'bottom-center',
    onClose: () => {
      if (!undone) {
        onKept?.();
      }
    },
    message: (
      <UndoMessage
        message={message}
        onUndo={async () => {
          await onUndo();
          undone = true;
          notifications.hide(id);
        }}
      />
    ),
  });
}

/** The message and its undo button, inside the toast. */
function UndoMessage({
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
