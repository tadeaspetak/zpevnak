import { Button, Group, Modal, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { ErrorText } from './ErrorText.tsx';

/**
 * Asks before something that can't be taken back: what will happen, Cancel, and the red
 * button. A failure shows here, in the dialog, where the eye is: not on the page behind it.
 */
export function ConfirmModal({
  opened,
  onClose,
  title,
  children,
  confirmLabel,
  onConfirm,
  loading,
  disabled = false,
  error,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  loading: boolean;
  disabled?: boolean;
  error: unknown;
}) {
  const { t } = useI18n();
  return (
    <Modal opened={opened} onClose={onClose} title={title}>
      <Stack>
        {children}
        <ErrorText error={error} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button color="red" loading={loading} disabled={disabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
