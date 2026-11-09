import {
  ActionIcon,
  Divider,
  Group,
  Menu,
  Popover,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconDots,
  IconEdit,
  IconMaximize,
  IconMinimize,
  IconMinus,
  IconPlaylistAdd,
  IconPlus,
  IconGrid3x3,
  IconRestore,
  IconTypography,
} from '@tabler/icons-react';
import { Link } from 'react-router';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal.tsx';
import { SearchButton } from '../components/SearchButton.tsx';
import { FONT_SCALES, usePrefs } from '../data/prefs.ts';
import type { SongRecord } from '../data/store.ts';
import { useFullscreen } from '../hooks/useFullscreen.ts';
import { useHideOnScroll } from '../hooks/useHideOnScroll.ts';
import { useI18n } from '../i18n/index.tsx';
import { url } from '../urls.ts';
import classes from './SongToolbar.module.css';

type Props = {
  backTo: string;
  backLabel: string;
  song: SongRecord;
  originalKey: string | null;
  shownKey: string | null;
  semitones: number;
  hasDiagrams: boolean;
  canEdit: boolean;
  canAddToPlaylist: boolean;
};

/**
 * The only chrome over a song. It slides away while the reader scrolls into the song and
 * comes back on scrolling up, so the song gets the whole screen.
 */
export function SongToolbar(props: Props) {
  const {
    backTo,
    backLabel,
    song,
    shownKey,
    semitones,
    hasDiagrams,
    canEdit,
    canAddToPlaylist,
  } = props;
  const { t } = useI18n();
  const [hidden] = useHideOnScroll();
  const prefs = usePrefs();
  const fullscreen = useFullscreen();
  const [adding, { open: openAdd, close: closeAdd }] = useDisclosure(false);

  const keyLabel =
    shownKey ??
    (semitones === 0 ? '±0' : semitones > 0 ? `+${semitones}` : `${semitones}`);

  return (
    <>
      <header className={classes.bar} data-hidden={hidden || undefined}>
        <Group gap={4} wrap="nowrap" className={classes.inner}>
          <Tooltip label={backLabel}>
            <ActionIcon
              component={Link}
              to={backTo}
              variant="subtle"
              color="gray"
              size="xl"
              aria-label={backLabel}
            >
              <IconArrowLeft size={24} />
            </ActionIcon>
          </Tooltip>

          <div className={classes.spacer} />

          <Group
            gap={0}
            wrap="nowrap"
            className={classes.transpose}
            role="group"
            aria-label={t('song.transpose')}
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xl"
              radius="xl"
              onClick={() => prefs.setTranspose(song.id, semitones - 1)}
              aria-label={t('song.transposeDown')}
            >
              <IconMinus size={18} />
            </ActionIcon>
            <Tooltip label={t('song.transposeReset')} disabled={semitones === 0}>
              <UnstyledButton
                className={classes.key}
                data-changed={semitones !== 0 || undefined}
                onClick={() => prefs.setTranspose(song.id, 0)}
                aria-label={`${keyLabel}: ${semitones === 0 ? t('song.transpose') : t('song.transposeReset')}`}
              >
                <Text fw={700} size="sm" span>
                  {keyLabel}
                </Text>
              </UnstyledButton>
            </Tooltip>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xl"
              radius="xl"
              onClick={() => prefs.setTranspose(song.id, semitones + 1)}
              aria-label={t('song.transposeUp')}
            >
              <IconPlus size={18} />
            </ActionIcon>
          </Group>

          <Popover position="bottom" shadow="md" withArrow>
            <Popover.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xl"
                aria-label={t('song.textSize')}
              >
                <IconTypography size={22} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown p={4}>
              <Group gap={4} wrap="nowrap" role="group" aria-label={t('song.textSize')}>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="xl"
                  onClick={() => prefs.stepFont(-1)}
                  disabled={prefs.fontScale <= (FONT_SCALES[0] ?? 0)}
                  aria-label={t('song.smaller')}
                >
                  <IconMinus size={18} />
                </ActionIcon>
                <Text size="sm" fw={600} w="3.5rem" ta="center" aria-live="polite">
                  {t('song.textSizeValue', {
                    percent: Math.round(prefs.fontScale * 100),
                  })}
                </Text>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="xl"
                  onClick={() => prefs.stepFont(1)}
                  disabled={prefs.fontScale >= (FONT_SCALES.at(-1) ?? 0)}
                  aria-label={t('song.larger')}
                >
                  <IconPlus size={18} />
                </ActionIcon>
              </Group>
            </Popover.Dropdown>
          </Popover>

          {fullscreen.supported && (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xl"
              onClick={fullscreen.toggle}
              aria-label={
                fullscreen.active ? t('song.exitFullscreen') : t('song.fullscreen')
              }
              className={classes.wideOnly}
            >
              {fullscreen.active ? (
                <IconMinimize size={22} />
              ) : (
                <IconMaximize size={22} />
              )}
            </ActionIcon>
          )}

          <Menu position="bottom-end" width={260}>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xl"
                aria-label={t('song.more')}
              >
                <IconDots size={22} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {fullscreen.supported ? (
                <Menu.Item
                  leftSection={
                    fullscreen.active ? (
                      <IconMinimize size={16} />
                    ) : (
                      <IconMaximize size={16} />
                    )
                  }
                  onClick={fullscreen.toggle}
                >
                  {fullscreen.active ? t('song.exitFullscreen') : t('song.fullscreen')}
                </Menu.Item>
              ) : (
                !fullscreen.standalone && (
                  <Menu.Label className={classes.hint}>
                    {t('song.fullscreenHint')}
                  </Menu.Label>
                )
              )}
              {hasDiagrams && (
                <Menu.Item
                  leftSection={<IconGrid3x3 size={16} />}
                  onClick={() => prefs.setShowDiagrams(!prefs.showDiagrams)}
                  rightSection={prefs.showDiagrams ? '✓' : null}
                  disabled={semitones !== 0}
                >
                  {t('song.diagrams')}
                </Menu.Item>
              )}
              {semitones !== 0 && (
                <Menu.Item
                  leftSection={<IconRestore size={16} />}
                  onClick={() => prefs.setTranspose(song.id, 0)}
                >
                  {t('song.transposeReset')}
                </Menu.Item>
              )}
              {canAddToPlaylist && (
                <Menu.Item leftSection={<IconPlaylistAdd size={16} />} onClick={openAdd}>
                  {t('song.addToPlaylist')}
                </Menu.Item>
              )}
              {canEdit && (
                <Menu.Item
                  component={Link}
                  to={url.editSong(song.id)}
                  leftSection={<IconEdit size={16} />}
                >
                  {t('song.edit')}
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
          {/* Song controls to the left, the whole app to the right: search sits last on
              every page's header, so it is always in the same place. */}
          <Divider orientation="vertical" my={10} />
          <SearchButton size="xl" />
        </Group>
      </header>
      <AddToPlaylistModal songId={adding ? song.id : null} onClose={closeAdd} />
    </>
  );
}
