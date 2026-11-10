import {
  ActionIcon,
  Button,
  CopyButton,
  Divider,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconCopy,
  IconDoorExit,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { leavePlaylist, usePlayer } from '../data/session.ts';
import { putPlaylist } from '../data/catalog.ts';
import type { PlaylistRecord } from '../data/store.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc, trpcClient } from '../trpc.ts';
import { url } from '../urls.ts';
import { ErrorText } from './ErrorText.tsx';

type Props = { playlist: PlaylistRecord; opened: boolean; onClose: () => void };

/**
 * Who is in a playlist, and how to bring someone in. Everyone in it sees the people; the owner
 * also gets the invite link (copy it, or replace it) and can take someone out; a collaborator
 * can leave.
 */
export function ShareModal({ playlist, opened, onClose }: Props) {
  const { t } = useI18n();
  const isOwner = playlist.role === 'owner';
  const utils = trpc.useUtils();
  const members = trpc.playlists.members.useQuery(
    { id: playlist.id },
    { enabled: opened },
  );
  const invite = trpc.playlists.invite.useQuery(
    { id: playlist.id },
    { enabled: opened && isOwner },
  );
  const reset = trpc.playlists.resetInvite.useMutation({
    onSuccess: (data) => utils.playlists.invite.setData({ id: playlist.id }, data),
  });
  const remove = trpc.playlists.removeCollaborator.useMutation();
  const removePerson = (person: { id: number; displayName: string }) =>
    remove.mutate(
      { id: playlist.id, userId: person.id },
      {
        onSuccess: async (record) => {
          putPlaylist(record.id, record);
          await utils.playlists.members.invalidate({ id: playlist.id });
          // One tap removes, so one tap brings them back (D87).
          const toastId = `removed-${playlist.id}-${person.id}`;
          notifications.show({
            id: toastId,
            autoClose: 8000,
            // At the top it would cover the dialog it belongs to: its title and close button.
            position: 'bottom-center',
            message: (
              <UndoRemoval
                name={person.displayName}
                onUndo={async () => {
                  const restored = await trpcClient.playlists.restoreCollaborator.mutate({
                    id: playlist.id,
                    userId: person.id,
                  });
                  putPlaylist(restored.id, restored);
                  await utils.playlists.members.invalidate({ id: playlist.id });
                  notifications.hide(toastId);
                }}
              />
            ),
          });
        },
      },
    );
  const token = invite.data?.token;
  const link = token ? `${window.location.origin}${url.join(token)}` : '';

  return (
    <Modal opened={opened} onClose={onClose} title={t('playlists.share')}>
      <Stack gap="lg">
        {isOwner && (
          <Stack gap="xs">
            <Text size="sm">{t('playlists.inviteIntro')}</Text>
            <Group gap="xs" wrap="nowrap" align="flex-end">
              <TextInput
                readOnly
                value={link}
                aria-label={t('playlists.copyLink')}
                style={{ flex: 1 }}
                onFocus={(e) => e.currentTarget.select()}
                rightSection={invite.isLoading ? <Loader size="xs" /> : null}
              />
              <CopyButton value={link}>
                {({ copied, copy }) => (
                  <Button
                    onClick={copy}
                    disabled={!link}
                    leftSection={
                      copied ? <IconCheck size={16} /> : <IconCopy size={16} />
                    }
                  >
                    {copied ? t('playlists.copied') : t('playlists.copyLink')}
                  </Button>
                )}
              </CopyButton>
            </Group>
            <Stack gap={4} align="flex-start">
              <Button
                variant="default"
                size="xs"
                leftSection={<IconRefresh size={14} />}
                loading={reset.isPending}
                onClick={() => reset.mutate({ id: playlist.id })}
              >
                {t('playlists.resetLink')}
              </Button>
              <Text size="xs" c="dimmed">
                {t('playlists.resetHint')}
              </Text>
            </Stack>
            <ErrorText error={invite.error ?? reset.error} />
          </Stack>
        )}

        <Stack gap={4}>
          <Title order={3} fz="sm" fw={700}>
            {t('playlists.people')}
          </Title>
          {members.isLoading && <Loader size="sm" />}
          {members.data?.map((person) => (
            <Group key={person.id} justify="space-between" wrap="nowrap">
              <div>
                <Text fw={500}>{person.displayName}</Text>
                <Text size="xs" c="dimmed">
                  {t(`playlists.role.${person.role}`)}
                </Text>
              </div>
              {isOwner && person.role === 'collaborator' && (
                <Tooltip
                  label={t('playlists.removePerson', { name: person.displayName })}
                >
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={t('playlists.removePerson', { name: person.displayName })}
                    loading={remove.isPending && remove.variables?.userId === person.id}
                    onClick={() => removePerson(person)}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          ))}
          <ErrorText error={members.error ?? remove.error} />
        </Stack>

        {playlist.role === 'collaborator' && (
          <>
            <Divider />
            <LeaveButton playlist={playlist} />
          </>
        )}
      </Stack>
    </Modal>
  );
}

/**
 * The toast after a removal. It lives outside the dialog, so it calls the server directly and
 * keeps working after the dialog closes.
 */
function UndoRemoval({ name, onUndo }: { name: string; onUndo: () => Promise<void> }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text size="sm">{t('playlists.removed', { name })}</Text>
        <Button
          size="xs"
          variant="default"
          style={{ flexShrink: 0 }}
          loading={pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            try {
              await onUndo();
            } catch (e) {
              setError(e);
              setPending(false);
            }
          }}
        >
          {t('playlists.undoRemove')}
        </Button>
      </Group>
      <ErrorText error={error} />
    </Stack>
  );
}

function LeaveButton({ playlist }: { playlist: PlaylistRecord }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { session } = usePlayer();
  const [confirming, setConfirming] = useState(false);
  const leave = trpc.playlists.leave.useMutation({
    onSuccess: () => {
      if (session?.playlistId === playlist.id) {
        leavePlaylist();
      }
      // A public playlist stays visible after leaving, just no longer as yours.
      putPlaylist(
        playlist.id,
        playlist.isPublic ? { ...playlist, role: null, collaboratorCount: null } : null,
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
          onClick={() => leave.mutate({ id: playlist.id })}
        >
          {t('playlists.leave')}
        </Button>
      </Group>
      <ErrorText error={leave.error} />
    </Stack>
  );
}
