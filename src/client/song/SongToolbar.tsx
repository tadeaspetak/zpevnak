import {
  ActionIcon,
  Divider,
  Group,
  Indicator,
  Menu,
  Popover,
  Stack,
  Switch,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconClef,
  IconDots,
  IconEdit,
  IconMaximize,
  IconMinimize,
  IconMessageReport,
  IconMinus,
  IconPlaylistAdd,
  IconPlus,
  IconTrash,
  IconAdjustmentsHorizontal,
} from '@tabler/icons-react';
import { Link } from 'react-router';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal.tsx';
import { DeleteSongModal } from '../components/DeleteSongModal.tsx';
import { mailtoAuthor } from '../contact.ts';
import { SearchButton } from '../components/SearchButton.tsx';
import { FONT_SCALES, usePrefs } from '../data/prefs.ts';
import type { SongRecord } from '../data/store.ts';
import { useWide } from '../hooks/useBreakpoints.ts';
import { useFullscreen } from '../hooks/useFullscreen.ts';
import { useI18n } from '../i18n/index.tsx';
import { url } from '#shared/urls.ts';
import classes from './SongToolbar.module.css';
import { IconButton } from '../components/IconButton.tsx';

type Props = {
  backTo: string;
  backLabel: string;
  song: SongRecord;
  originalKey: string | null;
  shownKey: string | null;
  semitones: number;
  hasDiagrams: boolean;
  /** May edit the song, and so delete it: the same people (canChangeSong, D78). */
  canEdit: boolean;
  canAddToPlaylist: boolean;
  /** Out of the way: scrolled away, or the reader tapped the song (`useHideOnScroll`). */
  hidden: boolean;
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
    originalKey,
    shownKey,
    semitones,
    hasDiagrams,
    canEdit,
    canAddToPlaylist,
    hidden,
  } = props;
  const { t } = useI18n();
  const prefs = usePrefs();
  const fullscreen = useFullscreen();
  const wide = useWide();
  const [adding, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const [deleting, { open: openDelete, close: closeDelete }] = useDisclosure(false);

  // A song without a {key} shows how far it's transposed instead. A real minus sign: a
  // hyphen reads as a dash.
  const keyLabel =
    shownKey ??
    (semitones === 0 ? '±0' : semitones > 0 ? `+${semitones}` : `−${-semitones}`);
  const resetLabel = originalKey
    ? t('song.backToKey', { key: originalKey })
    : t('song.transposeReset');

  return (
    <>
      <header className={classes.bar} data-hidden={hidden || undefined}>
        <Group gap={4} wrap="nowrap" className={classes.inner}>
          <IconButton label={backLabel} to={backTo} size="xl">
            <IconArrowLeft size={24} />
          </IconButton>

          <div className={classes.spacer} />

          <Group
            gap={0}
            wrap="nowrap"
            className={classes.transpose}
            role="group"
            aria-label={t('song.transpose')}
          >
            <ActionIcon
              size="lg"
              onClick={() => prefs.setTranspose(song.id, semitones - 1)}
              aria-label={t('song.transposeDown')}
            >
              <IconMinus size={18} />
            </ActionIcon>
            {/* In the song's own key, the key only shows. Transposed (from last time too,
                D24), it turns into an orange button that takes the song back: it can't go
                unnoticed, and the way back is where the eye already is. */}
            {semitones === 0 ? (
              <span className={classes.key}>
                <IconClef size={18} aria-hidden />
                <Text fw={700} size="sm" span>
                  {keyLabel}
                </Text>
              </span>
            ) : (
              <Tooltip label={resetLabel}>
                <UnstyledButton
                  className={classes.key}
                  data-changed
                  onClick={() => prefs.setTranspose(song.id, 0)}
                  aria-label={`${keyLabel}: ${resetLabel}`}
                >
                  <IconClef size={18} aria-hidden />
                  <Text fw={700} size="sm" span>
                    {keyLabel}
                  </Text>
                </UnstyledButton>
              </Tooltip>
            )}
            <ActionIcon
              size="lg"
              onClick={() => prefs.setTranspose(song.id, semitones + 1)}
              aria-label={t('song.transposeUp')}
            >
              <IconPlus size={18} />
            </ActionIcon>
          </Group>

          <Popover position="bottom-end" shadow="md" withArrow width={300}>
            <Popover.Target>
              <ActionIcon
                size="xl"
                aria-label={
                  prefs.showChords
                    ? t('song.display')
                    : `${t('song.display')}: ${t('song.chordsHidden')}`
                }
                aria-haspopup="dialog"
              >
                {/* Hidden chords are remembered too: a dot says so, from the toolbar. */}
                <Indicator size={8} offset={2} disabled={prefs.showChords}>
                  <IconAdjustmentsHorizontal size={22} />
                </Indicator>
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              {/* How the song is shown, on this device: everything a reader tunes in one place. */}
              <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" fw={500} style={{ whiteSpace: 'nowrap' }}>
                    {t('song.textSize')}
                  </Text>
                  <Group
                    gap={0}
                    wrap="nowrap"
                    role="group"
                    aria-label={t('song.textSize')}
                  >
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
                {/* Columns only ever apply on a wide screen (D25); a phone has nothing to switch. */}
                {wide && (
                  <Switch
                    label={t('song.columns')}
                    description={t('song.columnsHint')}
                    checked={prefs.showColumns}
                    onChange={(e) => prefs.setShowColumns(e.currentTarget.checked)}
                  />
                )}
                {hasDiagrams && (
                  <Switch
                    label={t('song.diagrams')}
                    checked={prefs.showChords && prefs.showDiagrams && semitones === 0}
                    // Diagrams draw chords: with chords hidden or transposed, there's nothing to draw.
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
              </Stack>
            </Popover.Dropdown>
          </Popover>

          {fullscreen.supported && (
            <ActionIcon
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
              <ActionIcon size="xl" aria-label={t('song.more')}>
                <IconDots size={22} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {fullscreen.supported ? (
                <Menu.Item
                  className={classes.narrowOnly}
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
              {canAddToPlaylist && (
                <Menu.Item leftSection={<IconPlaylistAdd size={16} />} onClick={openAdd}>
                  {t('song.addToPlaylist')}
                </Menu.Item>
              )}
              {/* Who can edit the song fixes it; everyone else tells the author. */}
              {!canEdit && (
                <Menu.Item
                  component="a"
                  href={mailtoAuthor(
                    t('song.reportSubject', {
                      title: song.artist ? `${song.title} – ${song.artist}` : song.title,
                    }),
                    t('song.reportBody', {
                      link: `${window.location.origin}${url.song(song)}`,
                    }),
                  )}
                  leftSection={<IconMessageReport size={16} />}
                >
                  {t('song.reportMistake')}
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
              {canEdit && (
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={openDelete}
                >
                  {t('song.delete')}
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
      {canEdit && <DeleteSongModal song={song} opened={deleting} onClose={closeDelete} />}
    </>
  );
}
