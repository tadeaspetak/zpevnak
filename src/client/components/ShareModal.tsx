import {
  Anchor,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDoorExit, IconEye, IconPencil, IconX } from '@tabler/icons-react';
import { type ReactNode, type Ref, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { url } from '#shared/urls.ts';
import { putPlaylist } from '../data/catalog.ts';
import { usePlaylistEdits } from '../data/playlistEdits.ts';
import { leavePlaylist, usePlayer } from '../data/session.ts';
import type { PlaylistRecord } from '../data/store.ts';
import { refocusWithin } from '../focus.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc, trpcClient } from '../trpc.ts';
import { ErrorText } from './ErrorText.tsx';
import { IconButton } from './IconButton.tsx';
import { ShareLinkButton } from './ShareLinkButton.tsx';
import { showUndoToast, UndoMessage } from './UndoToast.tsx';

type Props = { playlist: PlaylistRecord; opened: boolean; onClose: () => void };
type Person = { id: number; displayName: string };

/**
 * Sharing a playlist, in one place (D111). The owner first decides who sees it (public or not,
 * and the link for looking only), then who edits it with them: the invite link, and the people
 * in. Everyone in it sees the people; a collaborator can leave.
 */
export function ShareModal({ playlist, opened, onClose }: Props) {
  const { t } = useI18n();
  const isOwner = playlist.role === 'owner';
  const utils = trpc.useUtils();
  const edits = usePlaylistEdits(playlist.id);
  const members = trpc.playlists.members.useQuery(
    { id: playlist.id },
    { enabled: opened },
  );
  // The link is asked for (and made, the first time) when the owner opens this.
  const invite = trpc.playlists.invite.useMutation();
  const reset = trpc.playlists.resetInvite.useMutation();
  const { mutate: askForInvite, isIdle: notAskedYet } = invite;
  useEffect(() => {
    if (opened && isOwner && notAskedYet) {
      askForInvite({ id: playlist.id });
    }
  }, [opened, isOwner, notAskedYet, askForInvite, playlist.id]);
  const remove = trpc.playlists.removeCollaborator.useMutation();
  const [confirmingReset, setConfirmingReset] = useState(false);
  // Taken out while the dialog is open: they stay in the list, greyed, with the way back
  // where the keyboard can reach it. Closing the dialog hands that over to a toast (D87).
  const [removed, setRemoved] = useState<Person[]>([]);
  const people = useRef<HTMLDivElement>(null);

  const restore = async (person: Person) => {
    const restored = await trpcClient.playlists.restoreCollaborator.mutate({
      id: playlist.id,
      userId: person.id,
    });
    putPlaylist(restored.id, restored);
    await utils.playlists.members.invalidate({ id: playlist.id });
  };
  const removePerson = (person: Person) =>
    remove.mutate(
      { id: playlist.id, userId: person.id },
      {
        onSuccess: async (record) => {
          putPlaylist(record.id, record);
          setRemoved((list) => [...list, person]);
          await utils.playlists.members.invalidate({ id: playlist.id });
          refocusWithin(people.current);
        },
      },
    );
  const close = () => {
    for (const person of removed) {
      showUndoToast({
        id: `removed-${playlist.id}-${person.id}`,
        message: t('playlists.removed', { name: person.displayName }),
        onUndo: () => restore(person),
      });
    }
    setRemoved([]);
    onClose();
  };

  // A replaced link is the newer one.
  const token = reset.data?.token ?? invite.data?.token;
  const inviteLink = token ? `${window.location.origin}${url.join(token)}` : '';
  const viewLink = `${window.location.origin}${url.playlist(playlist)}`;
  const shown = members.data?.filter((p) => !removed.some((r) => r.id === p.id));

  return (
    <Modal opened={opened} onClose={close} title={t('playlists.share')}>
      <Stack gap="xl">
        <Section title={t('playlists.whoSees')}>
          {isOwner ? (
            <SegmentedControl
              fullWidth
              aria-label={t('playlists.whoSees')}
              value={playlist.isPublic ? 'public' : 'private'}
              onChange={(v) => edits.setPublic(v === 'public')}
              data={[
                { value: 'private', label: t('playlists.visibilityPrivate') },
                { value: 'public', label: t('playlists.visibilityPublic') },
              ]}
            />
          ) : null}
          <Text size="sm" c="dimmed">
            {playlist.isPublic ? t('playlists.viewLinkHint') : t('playlists.privateHint')}
          </Text>
          {playlist.isPublic && (
            <LinkBox
              icon={<IconEye size={18} />}
              title={t('playlists.viewLinkTitle')}
              description={t('playlists.viewLinkWhat')}
              link={viewLink}
            >
              <ShareLinkButton
                link={viewLink}
                title={playlist.name}
                copyLabel={t('playlists.copyViewLink')}
                sendLabel={t('playlists.sendViewLink')}
                variant="default"
              />
            </LinkBox>
          )}
        </Section>

        <Section
          title={t('playlists.people')}
          aside={t('playlists.peopleHint')}
          ref={people}
        >
          {members.isLoading && <Loader size="sm" />}
          {shown?.map((person) => (
            <Group key={person.id} justify="space-between" wrap="nowrap">
              <div>
                <Text fw={500}>{person.displayName}</Text>
                <Text size="xs" c="dimmed">
                  {t(`playlists.role.${person.role}`)}
                </Text>
              </div>
              {isOwner && person.role === 'collaborator' && (
                <IconButton
                  label={t('playlists.removePerson', { name: person.displayName })}
                  loading={remove.isPending && remove.variables?.userId === person.id}
                  onClick={() => removePerson(person)}
                >
                  <IconX size={18} />
                </IconButton>
              )}
            </Group>
          ))}
          {removed.map((person) => (
            <UndoMessage
              key={person.id}
              message={t('playlists.removed', { name: person.displayName })}
              onUndo={async () => {
                await restore(person);
                setRemoved((list) => list.filter((r) => r.id !== person.id));
              }}
            />
          ))}
          <ErrorText error={members.error ?? remove.error} />

          {isOwner && (
            <LinkBox
              icon={<IconPencil size={18} />}
              title={t('playlists.inviteTitle')}
              description={t('playlists.inviteIntro')}
              link={inviteLink}
            >
              {/* The old link stops working for everyone it was sent to: ask first, then
                  say so. */}
              {confirmingReset ? (
                <Stack gap="xs">
                  <Text size="sm">{t('playlists.resetHint')}</Text>
                  <Group gap="xs">
                    <Button
                      variant="default"
                      size="xs"
                      onClick={() => setConfirmingReset(false)}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      loading={reset.isPending}
                      onClick={() =>
                        reset.mutate(
                          { id: playlist.id },
                          { onSuccess: () => setConfirmingReset(false) },
                        )
                      }
                    >
                      {t('playlists.resetConfirm')}
                    </Button>
                  </Group>
                </Stack>
              ) : (
                <Group gap="md" wrap="wrap" align="center">
                  <ShareLinkButton
                    link={inviteLink}
                    title={playlist.name}
                    copyLabel={t('playlists.copyLink')}
                    sendLabel={t('playlists.sendLink')}
                  />
                  <Anchor
                    component="button"
                    type="button"
                    size="sm"
                    c="dimmed"
                    onClick={() => setConfirmingReset(true)}
                  >
                    {t('playlists.resetLink')}
                  </Anchor>
                </Group>
              )}
              {reset.isSuccess && !confirmingReset && (
                <Text size="sm" fw={600} role="status">
                  {t('playlists.resetDone')}
                </Text>
              )}
              <ErrorText error={invite.error ?? reset.error} />
            </LinkBox>
          )}
        </Section>

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
 * One link and what it gives whoever opens it: a box each, the two never confused (D113).
 * The link itself shows small, so a new one visibly replaces the old.
 */
function LinkBox({
  icon,
  title,
  description,
  link,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  link: string;
  children: ReactNode;
}) {
  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap="xs">
        <Group gap="xs" wrap="nowrap">
          {icon}
          <Text fw={600} size="sm">
            {title}
          </Text>
        </Group>
        <Text size="sm">{description}</Text>
        <Text size="xs" c="dimmed" truncate>
          {link || '…'}
        </Text>
        {children}
      </Stack>
    </Paper>
  );
}

function Section({
  title,
  aside,
  children,
  ref,
}: {
  title: string;
  /** A word on what the section is, beside its title. */
  aside?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <Stack gap="xs" ref={ref}>
      <Group gap="xs" align="baseline">
        <Title order={3} fz="md" fw={700}>
          {title}
        </Title>
        {aside && (
          <Text size="sm" c="dimmed">
            {aside}
          </Text>
        )}
      </Group>
      {children}
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
      notifications.show({ message: t('playlists.left', { name: playlist.name }) });
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
