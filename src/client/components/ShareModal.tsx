import {
  ActionIcon,
  Button,
  CopyButton,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  Popover,
  SegmentedControl,
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
  IconEye,
  IconPencil,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
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
import { showUndoToast, UndoMessage } from './UndoToast.tsx';

type Props = { playlist: PlaylistRecord; opened: boolean; onClose: () => void };
type Person = { id: number; displayName: string };

/**
 * Sharing a playlist, in one place (D111, D114). Who sees it (private or public, and the link
 * just to look), then the listmates who edit it with the owner, and the owner's invite for
 * more. Everyone in it sees the people; a collaborator can leave.
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
    <Modal
      opened={opened}
      onClose={close}
      title={t('playlists.shareTitle', { name: playlist.name })}
    >
      <Stack gap="xl">
        <Section title={t('playlists.whoSees')}>
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
        </Section>

        <Section
          title={t('playlists.people')}
          intro={isOwner ? t('playlists.peopleIntroOwner') : t('playlists.peopleIntro')}
          ref={people}
        >
          {members.isLoading && <Loader size="sm" />}
          {/* The people as one box, so they read as one list under the sentence. */}
          {shown && (
            <Paper withBorder radius="md">
              {shown.map((person, i) => (
                <Group
                  key={person.id}
                  justify="space-between"
                  wrap="nowrap"
                  px="sm"
                  py={6}
                  mih={50}
                  style={
                    i > 0
                      ? { borderTop: '1px solid var(--mantine-color-default-border)' }
                      : undefined
                  }
                >
                  {/* One line each: the heading already says they're listmates, so only the
                      owner is marked, where the others have their ×. */}
                  <Text fw={500}>{person.displayName}</Text>
                  {person.role === 'owner' ? (
                    <Text size="sm" c="dimmed">
                      {t('playlists.role.owner')}
                    </Text>
                  ) : (
                    isOwner && (
                      <IconButton
                        label={t('playlists.removePerson', { name: person.displayName })}
                        loading={
                          remove.isPending && remove.variables?.userId === person.id
                        }
                        onClick={() => removePerson(person)}
                      >
                        <IconX size={18} />
                      </IconButton>
                    )
                  )}
                </Group>
              ))}
            </Paper>
          )}
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
            <Stack gap="xs" mt="lg">
              <LinkField
                icon={<IconPencil size={16} />}
                label={t('playlists.inviteTitle')}
                description={t('playlists.inviteIntro')}
                link={inviteLink}
                loading={invite.isPending}
                extra={
                  // The old link stops working for everyone it was sent to: asked first,
                  // right where it was tapped.
                  <Popover
                    opened={confirmingReset}
                    onChange={setConfirmingReset}
                    position="bottom-end"
                    withArrow
                    shadow="md"
                    width={260}
                    trapFocus
                  >
                    <Popover.Target>
                      <ActionIcon
                        size="lg"
                        aria-label={t('playlists.resetLink')}
                        onClick={() => setConfirmingReset((o) => !o)}
                      >
                        <IconRefresh size={18} />
                      </ActionIcon>
                    </Popover.Target>
                    <Popover.Dropdown>
                      <Stack gap="xs">
                        <Text size="sm">{t('playlists.resetHint')}</Text>
                        <Group gap="xs" justify="flex-end">
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
                    </Popover.Dropdown>
                  </Popover>
                }
              />
              {reset.isSuccess && (
                <Text size="sm" fw={600} role="status">
                  {t('playlists.resetDone')}
                </Text>
              )}
              <ErrorText error={invite.error ?? reset.error} />
            </Stack>
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
 * A link to hand on, read only, named by what it gives (an eye to look, a pencil to edit), with
 * a copy button inside the field and any other action beside it.
 */
function LinkField({
  icon,
  label,
  description,
  link,
  loading = false,
  extra,
}: {
  icon: ReactNode;
  label: string;
  /** What the link does, between its name and the field. */
  description?: string;
  link: string;
  loading?: boolean;
  extra?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <TextInput
      readOnly
      label={
        <Group gap={6} wrap="nowrap" component="span">
          {icon}
          {label}
        </Group>
      }
      description={description}
      // A proper explanation, read before tapping: the size and colour of body text.
      descriptionProps={{
        fz: 'sm',
        lh: 1.45,
        c: 'var(--mantine-color-text)',
        mt: 2,
        mb: 8,
      }}
      value={link}
      onFocus={(e) => e.currentTarget.select()}
      rightSectionWidth={extra ? 76 : 40}
      rightSection={
        loading ? (
          <Loader size="xs" />
        ) : (
          <Group gap={2} wrap="nowrap">
            <CopyButton value={link}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? t('playlists.copied') : t('playlists.copyLink')}>
                  <ActionIcon
                    size="lg"
                    onClick={copy}
                    disabled={!link}
                    aria-label={t('playlists.copyLink')}
                    color={copied ? 'green' : undefined}
                  >
                    {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
            {extra}
          </Group>
        )
      }
    />
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

function Section({
  title,
  intro,
  children,
  ref,
}: {
  title: string;
  /** What the section is about, set close under its heading. */
  intro?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <Stack gap={8} ref={ref}>
      <Stack gap={2}>
        <Title order={3} fz="md" fw={700}>
          {title}
        </Title>
        {intro && <Text size="sm">{intro}</Text>}
      </Stack>
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
