import { Anchor, Button, Divider, Group, Modal, Paper, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEye } from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { url } from '#shared/urls.ts';
import { dropSong, putSong, useCatalog } from '../data/catalog.ts';
import type { SongRecord } from '../data/store.ts';
import { useOnline } from '../hooks/useOnline.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { ErrorText } from './ErrorText.tsx';
import {
  LeaveButton,
  LinkField,
  SharePeople,
  ShareSection,
  VisibilitySwitch,
} from './SharePeople.tsx';

type Props = { song: SongRecord; opened: boolean; onClose: () => void };

/**
 * Sharing a song (D127). Its owner keeps it private or publishes it; a private song then lists its
 * people and the owner's two invite links (`SharePeople`, as for playlists). Public is
 * publishing, so it asks first. Going back to private is open only while nobody else has a stake
 * in the song, and otherwise says why.
 */
export function SongShareModal({ song, opened, onClose }: Props) {
  const { t } = useI18n();
  const isOwner = song.role === 'owner';
  const isPrivate = song.status === 'private';
  const online = useOnline();
  const blockers = trpc.songs.privateBlockers.useQuery(
    { id: song.id },
    { enabled: opened && isOwner && !isPrivate },
  );
  const visibility = trpc.songs.setVisibility.useMutation({
    onSuccess: (saved) => {
      putSong(saved);
      // Said, as a new song's submission is: the switch alone doesn't tell it went through.
      notifications.show({
        message:
          saved.status === 'private' ? t('songs.madePrivate') : t('songs.published'),
      });
    },
  });
  const [publishing, setPublishing] = useState(false);
  const whyNotPrivate = blockers.data?.editedByOthers
    ? t('songs.cantGoPrivateEdited')
    : blockers.data?.inOthersPlaylists
      ? t('songs.cantGoPrivateUsed')
      : null;
  // Until the server has said, the way back isn't offered.
  const privateClosed = !isPrivate && (!blockers.data || whyNotPrivate !== null);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('songs.shareTitle', { name: song.title })}
    >
      <Stack gap="xl">
        <ShareSection title={t('songs.whoSees')}>
          <VisibilitySwitch
            label={t('songs.whoSees')}
            // Publishing or taking back is the server's to decide: not offline.
            readOnly={!isOwner || visibility.isPending || !online}
            value={isPrivate ? 'private' : 'public'}
            onChange={(v) => {
              if (v === 'public') {
                setPublishing(true);
              } else {
                visibility.mutate({ id: song.id, isPrivate: true });
              }
            }}
            choices={{
              private: {
                name: t('songs.visibilityPrivate'),
                what: t(isOwner ? 'songs.privateWhat' : 'songs.privateWhatOthers'),
                disabled: isOwner && privateClosed,
              },
              public: {
                name: t('songs.visibilityPublic'),
                what: t('songs.publicWhat'),
              },
            }}
          />
          {isOwner && whyNotPrivate && (
            <Text size="sm" c="dimmed">
              {whyNotPrivate}
            </Text>
          )}
          {publishing && (
            <Paper withBorder radius="md" p="sm">
              <Stack gap="xs">
                <Text size="sm">{t('songs.publishConfirm')}</Text>
                <Group justify="flex-end" gap="xs">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setPublishing(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    loading={visibility.isPending}
                    onClick={() =>
                      visibility.mutate(
                        { id: song.id, isPrivate: false },
                        { onSuccess: () => setPublishing(false) },
                      )
                    }
                  >
                    {t('songs.publish')}
                  </Button>
                </Group>
              </Stack>
            </Paper>
          )}
          <ErrorText error={visibility.error ?? blockers.error} />
          {/* Always there, as a playlist's is (D115): private, it still takes its people in. */}
          <LinkField
            icon={<IconEye size={16} />}
            label={t('songs.linkTitle')}
            description={t(isPrivate ? 'songs.linkPrivate' : 'songs.linkPublic')}
            link={`${window.location.origin}${url.song(song)}`}
          />
        </ShareSection>

        {isPrivate && isOwner && <SongPlaylists song={song} />}

        {/* Mounted while the dialog is open: closing it hands any undo to a toast. */}
        {isPrivate && <SharePeople kind="song" id={song.id} isOwner={isOwner} />}

        {song.role !== null && song.role !== 'owner' && (
          <>
            <Divider />
            <LeaveSong song={song} />
          </>
        )}
      </Stack>
    </Modal>
  );
}

function LeaveSong({ song }: { song: SongRecord }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <LeaveButton
      kind="song"
      id={song.id}
      label={t('songs.leave')}
      confirm={t('songs.leaveConfirm', { name: song.title })}
      onLeft={() => {
        notifications.show({ message: t('songs.left', { name: song.title }) });
        // A private song is gone from this device; a public one stays, no longer shared.
        if (song.status === 'private') {
          dropSong(song.id);
          navigate(url.home());
        } else {
          putSong({ ...song, role: null });
        }
      }}
    />
  );
}

/**
 * The other way a private song reaches people: the playlists it is in. Everyone in one reads it,
 * those who join later too, for as long as the song is in it and its owner is (D128). The owner
 * is in every one that counts, so this device knows them all.
 */
function SongPlaylists({ song }: { song: SongRecord }) {
  const { t, tn, compare } = useI18n();
  const { playlists } = useCatalog();
  const holding = [...playlists.values()]
    .filter((p) => p.songIds.includes(song.id))
    .sort((a, b) => compare(a.name, b.name));
  return (
    <ShareSection title={t('songs.inPlaylists')} intro={t('songs.playlistsRule')}>
      {holding.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('songs.inNoPlaylist')}
        </Text>
      ) : (
        <Stack gap={4}>
          {holding.map((p) => (
            <Text key={p.id} size="sm">
              <Anchor component={Link} to={url.playlist(p)} fw={600}>
                {p.name}
              </Anchor>
              <Text span c="dimmed">
                {' · '}
                {p.listmateCount
                  ? tn('playlists.collaborators', p.listmateCount)
                  : t('songs.onlyYou')}
              </Text>
            </Text>
          ))}
        </Stack>
      )}
    </ShareSection>
  );
}
