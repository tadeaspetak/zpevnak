import { Button, Group, List, Modal, Paper, Stack, Text, Title } from '@mantine/core';
import { IconDeviceMobilePlus, IconShare2, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { readLocal, writeLocal } from '../data/local.ts';
import { setInstallSteps, useInstall, useInstallSteps } from '../data/install.ts';
import { useI18n } from '../i18n/index.tsx';
import { IconButton } from './IconButton.tsx';

/**
 * "Přidat na plochu" where this device can (D141): on Android the browser's own dialog, on an
 * iPhone or iPad the steps through Share, in Firefox on Android through its menu (D142).
 * Nothing where there is nothing to offer. `onOpen`: what it was opened from gives way to it.
 */
export function InstallButton({
  fullWidth = false,
  variant = 'filled',
  onOpen,
}: {
  fullWidth?: boolean;
  /** Primary on the overview's card; among the settings, one of them (D61). */
  variant?: 'filled' | 'default';
  onOpen?: () => void;
}) {
  const { t } = useI18n();
  const { way, prompt } = useInstall();
  if (way === null) {
    return null;
  }
  return (
    <Button
      size="sm"
      variant={variant}
      fullWidth={fullWidth}
      leftSection={<IconDeviceMobilePlus size={18} />}
      onClick={() => {
        onOpen?.();
        if (way === 'prompt') {
          void prompt();
        } else {
          setInstallSteps(true);
        }
      }}
    >
      {t('install.add')}
    </Button>
  );
}

/** The steps, where a page can't install itself: one dialog for the app, beside search. */
export function InstallSteps() {
  const { t } = useI18n();
  const { way } = useInstall();
  const opened = useInstallSteps();
  const close = () => setInstallSteps(false);
  return (
    <Modal opened={opened} onClose={close} title={t('install.add')}>
      <Stack>
        {way === 'firefox' ? (
          <List type="ordered" spacing="sm">
            <List.Item>{t('install.firefoxMenu')}</List.Item>
            <List.Item>{t('install.firefoxAdd')}</List.Item>
            <List.Item>{t('install.firefoxConfirm')}</List.Item>
          </List>
        ) : (
          <List type="ordered" spacing="sm">
            <List.Item>
              {/* The icon beside its name, as it looks on the phone. */}
              {t('install.iosShare')}{' '}
              <IconShare2
                size={18}
                aria-hidden
                style={{ verticalAlign: 'text-bottom' }}
              />{' '}
              {t('install.iosShareWhere')}
            </List.Item>
            <List.Item>{t('install.iosAdd')}</List.Item>
            <List.Item>{t('install.iosConfirm')}</List.Item>
          </List>
        )}
        <Group justify="flex-end">
          <Button variant="default" size="sm" onClick={close}>
            {t('common.close')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/**
 * Once on the overview, on a phone or tablet that could have the app on its home screen: what
 * it gives, and the way there. Hidden for good on this device once closed; the settings keep
 * the button (D141).
 */
export function InstallHint() {
  const { t } = useI18n();
  const { way } = useInstall();
  const [hidden, setHidden] = useState(() => readLocal('installHintHidden') === '1');
  if (way === null || hidden) {
    return null;
  }
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
        <Stack gap={4}>
          <Title order={2} size="h5">
            {t('install.title')}
          </Title>
          <Text size="sm" c="dimmed">
            {t('install.why')}
          </Text>
        </Stack>
        <IconButton
          label={t('install.hide')}
          size="md"
          onClick={() => {
            writeLocal('installHintHidden', '1');
            setHidden(true);
          }}
        >
          <IconX size={16} />
        </IconButton>
      </Group>
      <Group mt="sm">
        <InstallButton />
      </Group>
    </Paper>
  );
}
