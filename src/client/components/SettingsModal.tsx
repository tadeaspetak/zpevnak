import {
  Modal,
  SegmentedControl,
  Stack,
  Text,
  useMantineColorScheme,
  type MantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconSettings } from '@tabler/icons-react';
import type { Locale } from '#shared/validators/index.ts';
import { useI18n } from '../i18n/index.tsx';
import { IconButton } from './IconButton.tsx';

/** Language and theme, per device, for everyone: a cogwheel opening a small dialog. */
export function SettingsButton() {
  const { t, locale, setLocale } = useI18n();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <IconButton label={t('settings.open')} onClick={open} aria-haspopup="dialog">
        <IconSettings size={22} />
      </IconButton>
      <Modal opened={opened} onClose={close} title={t('settings.open')} size="sm">
        <Stack gap="md">
          <div>
            <Text size="sm" fw={500} mb={4}>
              {t('account.language')}
            </Text>
            <SegmentedControl
              fullWidth
              value={locale}
              onChange={(v) => setLocale(v as Locale)}
              data={[
                { value: 'cs', label: 'Čeština' },
                { value: 'en', label: 'English' },
              ]}
            />
          </div>
          <div>
            <Text size="sm" fw={500} mb={4}>
              {t('account.theme')}
            </Text>
            <SegmentedControl
              fullWidth
              value={colorScheme}
              onChange={(v) => setColorScheme(v as MantineColorScheme)}
              data={[
                { value: 'auto', label: t('account.themeAuto') },
                { value: 'light', label: t('account.themeLight') },
                { value: 'dark', label: t('account.themeDark') },
              ]}
            />
          </div>
        </Stack>
      </Modal>
    </>
  );
}
