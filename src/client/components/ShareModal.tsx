import { Divider, Modal, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEye } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { url } from '#shared/urls.ts';
import { putPlaylist } from '../data/catalog.ts';
import { usePlaylistEdits } from '../data/playlistEdits.ts';
import { leavePlaylist, usePlayer } from '../data/session.ts';
import type { PlaylistRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';
import {
  LeaveButton,
  LinkField,
  SharePeople,
  ShareSection,
  VisibilitySwitch,
} from './SharePeople.tsx';

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
          <VisibilitySwitch
            label={t('playlists.whoSees')}
            readOnly={!isOwner}
            value={playlist.isPublic ? 'public' : 'private'}
            onChange={(v) => edits.setPublic(v === 'public')}
            choices={{
              private: {
                name: t('playlists.visibilityPrivate'),
                what: t('playlists.privateWhat'),
              },
              public: {
                name: t('playlists.visibilityPublic'),
                what: t('playlists.publicWhat'),
              },
            }}
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
            <LeavePlaylist playlist={playlist} />
          </>
        )}
      </Stack>
    </Modal>
  );
}

function LeavePlaylist({ playlist }: { playlist: PlaylistRecord }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { session } = usePlayer();
  return (
    <LeaveButton
      kind="playlist"
      id={playlist.id}
      label={t('playlists.leave')}
      confirm={t('playlists.leaveConfirm', { name: playlist.name })}
      onLeft={() => {
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
      }}
    />
  );
}
