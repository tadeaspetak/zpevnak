import {
  Button,
  Divider,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDoorExit, IconEye } from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { url } from '#shared/urls.ts';
import { putPlaylist } from '../data/catalog.ts';
import { usePlaylistEdits } from '../data/playlistEdits.ts';
import { leavePlaylist, usePlayer } from '../data/session.ts';
import type { PlaylistRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { ErrorText } from './ErrorText.tsx';
import { LinkField, SharePeople, ShareSection } from './SharePeople.tsx';

type Props = { playlist: PlaylistRecord; opened: boolean; onClose: () => void };

/**
 * Sharing a playlist, in one place (D111, D114). Who sees it (private or public, and the link
 * just to look), then the listmates, each editing it with the owner or only reading it, and the
 * owner's two invites for more (`SharePeople`, shared with songs). Anyone but the owner can
 * leave.
 */
export function ShareModal({ playlist, opened, onClose }: Props) {
  const { t } = useI18n();
  const isOwner = playlist.role === 'owner';
  const edits = usePlaylistEdits(playlist.id);

  const viewLink = `${window.location.origin}${url.playlist(playlist)}`;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('playlists.shareTitle', { name: playlist.name })}
    >
      <Stack gap="xl">
        <ShareSection title={t('playlists.whoSees')}>
          {/* Who sees it, each choice saying what it means. A listmate sees the same, unable to
              change it. */}
          <SegmentedControl
            fullWidth
            readOnly={!isOwner}
            aria-label={t('playlists.whoSees')}
            value={playlist.isPublic ? 'public' : 'private'}
            onChange={(v) => edits.setPublic(v === 'public')}
            // Two lines that may wrap differently: both segments as tall as the taller one.
            styles={{
              root: { alignItems: 'stretch' },
              control: { display: 'flex' },
              label: {
                whiteSpace: 'normal',
                paddingBlock: 6,
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              },
            }}
            data={[
              {
                value: 'private',
                label: (
                  <Choice
                    name={t('playlists.visibilityPrivate')}
                    what={t('playlists.privateWhat')}
                  />
                ),
              },
              {
                value: 'public',
                label: (
                  <Choice
                    name={t('playlists.visibilityPublic')}
                    what={t('playlists.publicWhat')}
                  />
                ),
              },
            ]}
          />
          {/* Always there, so the switch doesn't move things around: private, it still takes
              listmates straight in. */}
          <LinkField
            icon={<IconEye size={16} />}
            label={t('playlists.viewLinkTitle')}
            link={viewLink}
          />
        </ShareSection>

        {/* Mounted while the dialog is open: closing it hands any undo to a toast. */}
        <SharePeople kind="playlist" id={playlist.id} isOwner={isOwner} />

        {playlist.role !== null && playlist.role !== 'owner' && (
          <>
            <Divider />
            <LeaveButton playlist={playlist} />
          </>
        )}
      </Stack>
    </Modal>
  );
}

function Choice({ name, what }: { name: string; what: string }) {
  return (
    <Stack gap={0}>
      <Text size="sm" fw={600}>
        {name}
      </Text>
      <Text size="xs" c="dimmed" lh={1.3}>
        {what}
      </Text>
    </Stack>
  );
}

function LeaveButton({ playlist }: { playlist: PlaylistRecord }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { session } = usePlayer();
  const [confirming, setConfirming] = useState(false);
  const leave = trpc.sharing.leave.useMutation({
    onSuccess: () => {
      if (session?.playlistId === playlist.id) {
        leavePlaylist();
      }
      notifications.show({ message: t('playlists.left', { name: playlist.name }) });
      // A public playlist stays visible after leaving, just no longer as yours.
      putPlaylist(
        playlist.id,
        playlist.isPublic ? { ...playlist, role: null, listmateCount: null } : null,
      );
      navigate(url.playlists());
    },
  });
  if (!confirming) {
    return (
      <Button
        variant="outline"
        color="red"
        leftSection={<IconDoorExit size={16} />}
        onClick={() => setConfirming(true)}
      >
        {t('playlists.leave')}
      </Button>
    );
  }
  return (
    <Stack gap="xs">
      <Text size="sm">{t('playlists.leaveConfirm', { name: playlist.name })}</Text>
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={() => setConfirming(false)}>
          {t('common.cancel')}
        </Button>
        <Button
          color="red"
          loading={leave.isPending}
          onClick={() => leave.mutate({ kind: 'playlist', id: playlist.id })}
        >
          {t('playlists.leave')}
        </Button>
      </Group>
      <ErrorText error={leave.error} />
    </Stack>
  );
}
