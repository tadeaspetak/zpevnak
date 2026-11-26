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
  IconNotes,
  IconPlaylist,
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
import { SearchButton } from '../components/SearchButton.tsx';
import { SettingsButton } from '../components/SettingsButton.tsx';
import { usePrefs } from '../data/prefs.ts';
import { songText } from '../data/songText.ts';
import type { SongRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';
import { url } from '#shared/urls.ts';
import type { ReportOffer } from './reportOffer.ts';
import { SaveKeyModal } from './SaveKeyModal.tsx';
import classes from './SongToolbar.module.css';
import { IconButton } from '../components/IconButton.tsx';

type Props = {
  backTo: string;
  backLabel: string;
  song: SongRecord;
  shownKey: string | null;
  /** The key it starts from: a playlist's (D131), else the song's own; the way back goes there. */
  baseKey: string | null;
  /** How far it is transposed in all, from the song's text. */
  semitones: number;
  /** The player's own share of that, kept on this device; the rest is the playlist's. */
  own: number;
  /** The pitch the song starts from (`songPitch`), which a transposition is kept against. */
  pitch: number | null;
  hasDiagrams: boolean;
  /** May edit the song (canChangeSong, D78). */
  canEdit: boolean;
  /** May delete it: the same people for a public song, its owner alone for a private one. */
  canDelete: boolean;
  canAddToPlaylist: boolean;
  /**
   * Starts picking a line for a note (D135): the way in for whoever hasn't found the
   * long-press or the right-click, and for a keyboard. Undefined: no notes for this reader.
   */
  onAddNote?: () => void;
  /**
   * "Nahlásit chybu" (D143): opens the report, or leads where it can be written (signing in).
   * Null: not offered (the reader may fix the song themselves, or it's private).
   */
  report: ReportOffer;
  /** Out of the way: scrolled away, or the reader tapped the song (`useHideOnScroll`). */
  hidden: boolean;
  /** Played inside a playlist: its key for the song can be set there, by whoever edits it. */
  playlist: {
    name: string;
    hasKey: boolean;
    canSetKey: boolean;
    /** Plays the song `semitones` from its text in this playlist; 0 in its own key. */
    setKey: (semitones: number) => void;
  } | null;
};

/** A shift for a song that names no key: "+2", "−3" (a real minus: a hyphen reads as a dash). */
function shiftLabel(semitones: number): string {
  return semitones === 0 ? '±0' : semitones > 0 ? `+${semitones}` : `−${-semitones}`;
}

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
    baseKey,
    semitones,
    own,
    pitch,
    hasDiagrams,
    canEdit,
    canDelete,
    canAddToPlaylist,
    onAddNote,
    report,
    hidden,
    playlist,
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

  // A song without a {key} shows how far it's transposed instead.
  const keyLabel = shownKey ?? shiftLabel(semitones);
  // Back to where it starts: the playlist's key there, else the song's own. A song that names
  // no key goes back by its shift: to the playlist's ("+2"), else the original.
  const base = semitones - own;
  const resetLabel = baseKey
    ? t('song.backToKey', { key: baseKey })
    : base !== 0
      ? t('song.backToKey', { key: shiftLabel(base) })
      : t('song.transposeReset');

  const saveForEveryone = canEdit && own !== 0;
  const playForPlaylist = Boolean(playlist?.canSetKey) && own !== 0;
  const clearPlaylistKey = Boolean(playlist?.canSetKey && playlist.hasKey);
  const keyActions = saveForEveryone || playForPlaylist || clearPlaylistKey;

  // Played in the playlist's key (D131): its mark in place of the clef, so a reader knows the
  // key they see is the playlist's, not the song's.
  const keyIcon = playlist?.hasKey ? (
    <IconPlaylist size={18} role="img" aria-label={t('song.playlistKeyMark')} />
  ) : (
    <IconClef size={18} aria-hidden />
  );

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
              onClick={() => prefs.setTranspose(song.id, own - 1, pitch)}
              aria-label={t('song.transposeDown')}
            >
              <IconMinus size={18} />
            </ActionIcon>
            {/* In the key it starts from (its own, or its playlist's), the key only shows.
                Transposed by the player (from last time too, D24), it turns into an orange
                button that takes the song back: it can't go unnoticed, and the way back is
                where the eye already is. */}
            {own === 0 ? (
              <span className={classes.key}>
                {keyIcon}
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
                  {keyIcon}
                  <Text fw={700} size="sm" span>
                    {keyLabel}
                  </Text>
                </UnstyledButton>
              </Tooltip>
            )}
            <ActionIcon
              size="lg"
              onClick={() => prefs.setTranspose(song.id, own + 1, pitch)}
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
              {onAddNote && (
                <Menu.Item leftSection={<IconNotes size={16} />} onClick={onAddNote}>
                  {t('notes.add')}
                </Menu.Item>
              )}
              {canOpenSharing && (
                <Menu.Item leftSection={<IconUsers size={16} />} onClick={openShare}>
                  {t('songs.share')}
                </Menu.Item>
              )}
              {/* Who can edit the song fixes it; everyone else reports it to the editors. */}
              {report &&
                ('to' in report ? (
                  <Menu.Item
                    component={Link}
                    to={report.to}
                    leftSection={<IconMessageReport size={16} />}
                  >
                    {t('song.reportMistake')}
                  </Menu.Item>
                ) : (
                  <Menu.Item
                    leftSection={<IconMessageReport size={16} />}
                    onClick={report.onClick}
                  >
                    {t('song.reportMistake')}
                  </Menu.Item>
                ))}
              {/* What can be done with the key it's played in, under one heading (it names
                  the key, so the items needn't): kept for everyone, by who may edit the song,
                  only a key they came to themselves (D119); in a playlist, by who edits it, kept
                  there, or back to the song's own (D131). */}
              {keyActions && (
                <>
                  <Menu.Divider />
                  <Menu.Label>{t('song.keyGroup', { key: keyLabel })}</Menu.Label>
                </>
              )}
              {saveForEveryone && (
                <Menu.Item
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={openSaveKey}
                >
                  {t('song.keyForEveryone')}
                </Menu.Item>
              )}
              {playlist && playForPlaylist && (
                <Menu.Item
                  leftSection={<IconPlaylist size={16} />}
                  onClick={() => playlist.setKey(semitones)}
                >
                  {t('song.keyForPlaylist')}
                </Menu.Item>
              )}
              {playlist && clearPlaylistKey && (
                <Menu.Item
                  leftSection={<IconPlaylist size={16} />}
                  onClick={() => playlist.setKey(0)}
                >
                  {t('song.keyPlaylistOwn')}
                </Menu.Item>
              )}
              {keyActions && <Menu.Divider />}
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
          <SettingsButton size="xl" />
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
      {saveForEveryone && (
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
