import {
  ActionIcon,
  Group,
  Indicator,
  type MantineColorScheme,
  Popover,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { IconAdjustmentsHorizontal, IconMinus, IconPlus } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { Locale } from '#shared/validators/index.ts';
import { FONT_SCALES, usePrefs } from '../data/prefs.ts';
import { useWide } from '../hooks/useBreakpoints.ts';
import { useFullscreen } from '../hooks/useFullscreen.ts';
import { useI18n } from '../i18n/index.tsx';

type Props = {
  size?: 'lg' | 'xl';
  /** In a song: whether it has diagrams, and how far it's transposed (diagrams need its key). */
  song?: { hasDiagrams: boolean; semitones: number };
};

/**
 * Every setting, on this device, from every page (D113): how songs are shown, full screen
 * (a switch, so it says whether it's on), and the app's language and look. Next to search, at
 * the top right everywhere.
 */
export function SettingsButton({ size = 'lg', song }: Props) {
  const { t, locale, setLocale } = useI18n();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const prefs = usePrefs();
  const fullscreen = useFullscreen();
  const wide = useWide();
  const semitones = song?.semitones ?? 0;
  const label = prefs.showChords
    ? t('settings.open')
    : `${t('settings.open')}: ${t('song.chordsHidden')}`;
  return (
    <Popover position="bottom-end" shadow="md" withArrow width={320} trapFocus>
      <Popover.Target>
        <ActionIcon size={size} aria-label={label} aria-haspopup="dialog">
          {/* Hidden chords are remembered too: a dot says so, from every page. */}
          <Indicator size={8} offset={2} disabled={prefs.showChords}>
            <IconAdjustmentsHorizontal size={size === 'xl' ? 22 : 20} />
          </Indicator>
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="lg">
          <Part title={t('settings.songs')}>
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" fw={500} style={{ whiteSpace: 'nowrap' }}>
                {t('song.textSize')}
              </Text>
              <Group gap={0} wrap="nowrap" role="group" aria-label={t('song.textSize')}>
                <ActionIcon
                  size="lg"
                  onClick={() => prefs.stepFont(-1)}
                  disabled={prefs.fontScale <= (FONT_SCALES[0] ?? 0)}
                  aria-label={t('song.smaller')}
                >
                  <IconMinus size={16} />
                </ActionIcon>
                <Text size="sm" fw={600} w="3rem" ta="center" aria-live="polite">
                  {t('song.textSizeValue', {
                    percent: Math.round(prefs.fontScale * 100),
                  })}
                </Text>
                <ActionIcon
                  size="lg"
                  onClick={() => prefs.stepFont(1)}
                  disabled={prefs.fontScale >= (FONT_SCALES.at(-1) ?? 0)}
                  aria-label={t('song.larger')}
                >
                  <IconPlus size={16} />
                </ActionIcon>
              </Group>
            </Group>
            <Switch
              label={t('song.chords')}
              checked={prefs.showChords}
              onChange={(e) => prefs.setShowChords(e.currentTarget.checked)}
            />
            {/* Columns only ever apply on a wide screen (D88); a phone has nothing to switch. */}
            {wide && (
              <Switch
                label={t('song.columns')}
                description={t('song.columnsHint')}
                checked={prefs.showColumns}
                onChange={(e) => prefs.setShowColumns(e.currentTarget.checked)}
              />
            )}
            {/* Only the song's own diagrams exist; outside a song, the preference itself. */}
            {(!song || song.hasDiagrams) && (
              <Switch
                label={t('song.diagrams')}
                checked={prefs.showChords && prefs.showDiagrams && semitones === 0}
                // Diagrams draw chords: hidden or transposed, there's nothing to draw.
                disabled={!prefs.showChords || semitones !== 0}
                description={
                  !prefs.showChords
                    ? t('song.diagramsNeedChords')
                    : semitones !== 0
                      ? t('song.diagramsNeedOriginalKey')
                      : undefined
                }
                onChange={(e) => prefs.setShowDiagrams(e.currentTarget.checked)}
              />
            )}
            {fullscreen.supported ? (
              <Switch
                label={t('song.fullscreen')}
                checked={fullscreen.active}
                onChange={fullscreen.toggle}
              />
            ) : (
              // An iPhone has no full screen for pages: added to the home screen, it opens
              // without the browser's bars instead.
              !fullscreen.standalone && (
                <Text size="sm" c="dimmed">
                  {t('song.fullscreenHint')}
                </Text>
              )
            )}
          </Part>
          <Part title={t('settings.app')}>
            <SegmentedControl
              fullWidth
              aria-label={t('account.language')}
              value={locale}
              onChange={(v) => setLocale(v as Locale)}
              data={[
                { value: 'cs', label: 'Čeština' },
                { value: 'en', label: 'English' },
              ]}
            />
            <SegmentedControl
              fullWidth
              aria-label={t('account.theme')}
              value={colorScheme}
              onChange={(v) => setColorScheme(v as MantineColorScheme)}
              data={[
                { value: 'auto', label: t('account.themeAuto') },
                { value: 'light', label: t('account.themeLight') },
                { value: 'dark', label: t('account.themeDark') },
              ]}
            />
          </Part>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="sm">
      <Title order={2} fz="xs" fw={700} tt="uppercase" c="dimmed" lts="0.05em">
        {title}
      </Title>
      {children}
    </Stack>
  );
}
