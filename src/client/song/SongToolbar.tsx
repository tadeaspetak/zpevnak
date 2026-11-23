import {
  ActionIcon,
  Divider,
  Group,
  Menu,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconClef,
  IconDeviceFloppy,
  IconDots,
  IconEdit,
  IconMessageReport,
  IconMinus,
  IconPlaylistAdd,
  IconPlus,
  IconTag,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { Link } from 'react-router';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal.tsx';
import { DeleteSongModal } from '../components/DeleteSongModal.tsx';
import { SongShareModal } from '../components/SongShareModal.tsx';
import { mailtoAuthor } from '../contact.ts';
import { SearchButton } from '../components/SearchButton.tsx';
import { SettingsButton } from '../components/SettingsButton.tsx';
import { usePrefs } from '../data/prefs.ts';
import { songText } from '../data/songText.ts';
import type { SongRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';
import { url } from '#shared/urls.ts';
import { SaveKeyModal } from './SaveKeyModal.tsx';
import classes from './SongToolbar.module.css';
import { IconButton } from '../components/IconButton.tsx';

type Props = {
  backTo: string;
  backLabel: string;
  song: SongRecord;
  originalKey: string | null;
  shownKey: string | null;
  semitones: number;
  /** The pitch the song starts from (`songPitch`), which a transposition is kept against. */
  pitch: number | null;
  hasDiagrams: boolean;
  /** May edit the song (canChangeSong, D78). */
  canEdit: boolean;
  /** May delete it: the same people for a public song, its owner alone for a private one. */
  canDelete: boolean;
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
    pitch,
    hasDiagrams,
    canEdit,
    canDelete,
    canAddToPlaylist,
    hidden,
  } = props;
  const { t } = useI18n();
  const prefs = usePrefs();
  const [adding, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const [deleting, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const [savingKey, { open: openSaveKey, close: closeSaveKey }] = useDisclosure(false);
  const [sharing, { open: openShare, close: closeShare }] = useDisclosure(false);
  const isPrivate = song.status === 'private';
  // A private song's people, and the owner of a public one (who may still take it back).
  const canOpenSharing = song.role !== null && (isPrivate || song.role === 'owner');
  const tags = songText(song).tags;

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
              onClick={() => prefs.setTranspose(song.id, semitones - 1, pitch)}
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
                  onClick={() => prefs.setTranspose(song.id, 0, pitch)}
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
              onClick={() => prefs.setTranspose(song.id, semitones + 1, pitch)}
              aria-label={t('song.transposeUp')}
            >
              <IconPlus size={18} />
            </ActionIcon>
          </Group>

          <Menu position="bottom-end" width={260}>
            <Menu.Target>
              <ActionIcon size="xl" aria-label={t('song.more')}>
                <IconDots size={22} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {/* What the song is, before what can be done with it; each leads to its songs. */}
              {tags.length > 0 && (
                <>
                  <Menu.Label>{t('song.tags')}</Menu.Label>
                  {tags.map((tag) => (
                    <Menu.Item
                      key={tag}
                      component={Link}
                      to={url.tag(tag)}
                      leftSection={<IconTag size={16} />}
                    >
                      {tag}
                    </Menu.Item>
                  ))}
                  <Menu.Divider />
                </>
              )}
              {canAddToPlaylist && (
                <Menu.Item leftSection={<IconPlaylistAdd size={16} />} onClick={openAdd}>
                  {t('song.addToPlaylist')}
                </Menu.Item>
              )}
              {canOpenSharing && (
                <Menu.Item leftSection={<IconUsers size={16} />} onClick={openShare}>
                  {t('songs.share')}
                </Menu.Item>
              )}
              {/* Who can edit the song fixes it; everyone else tells the author. Not about a
                  private song: the author doesn't see those. */}
              {!canEdit && !isPrivate && (
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
              {/* Who may edit the song may make the key they picked its own (D119). */}
              {canEdit && semitones !== 0 && (
                <Menu.Item
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={openSaveKey}
                >
                  {shownKey
                    ? t('song.saveKey', { key: shownKey })
                    : t('song.saveTransposed')}
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
              {canDelete && (
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
          {/* Song controls to the left, the whole app to the right: settings, then search,
              last on every page's header, so they are always in the same place. */}
          <Divider orientation="vertical" my={10} />
          <SettingsButton size="xl" song={{ hasDiagrams, semitones }} />
          <SearchButton size="xl" />
        </Group>
      </header>
      <AddToPlaylistModal songId={adding ? song.id : null} onClose={closeAdd} />
      {canDelete && (
        <DeleteSongModal song={song} opened={deleting} onClose={closeDelete} />
      )}
      {canOpenSharing && (
        <SongShareModal song={song} opened={sharing} onClose={closeShare} />
      )}
      {canEdit && semitones !== 0 && (
        <SaveKeyModal
          song={song}
          semitones={semitones}
          shownKey={shownKey}
          hasDiagrams={hasDiagrams}
          opened={savingKey}
          onClose={closeSaveKey}
        />
      )}
    </>
  );
}
