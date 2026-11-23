import {
  ActionIcon,
  Button,
  CopyButton,
  Group,
  Loader,
  NativeSelect,
  Paper,
  Popover,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconBook,
  IconCheck,
  IconCopy,
  IconPencil,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { type ReactNode, type Ref, useEffect, useRef, useState } from 'react';
import {
  editsAsMember,
  JOIN_ROLES,
  type JoinRole,
  type MemberRole,
  type SharedKind,
} from '#shared/roles.ts';
import { url } from '#shared/urls.ts';
import { putShared } from '../data/catalog.ts';
import { refocusWithin } from '../focus.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc, trpcClient } from '../trpc.ts';
import { ErrorText } from './ErrorText.tsx';
import { IconButton } from './IconButton.tsx';
import { showUndoToast, UndoMessage } from './UndoToast.tsx';

type Person = { id: number; displayName: string; role: MemberRole };

/** The words that differ by what is shared. */
const TEXT = {
  playlist: {
    people: 'playlists.people',
    peopleIntro: 'playlists.peopleIntro',
    peopleIntroOwner: 'playlists.peopleIntroOwner',
    collaboratorInvite: 'playlists.inviteIntro',
    viewerInvite: 'playlists.viewInviteIntro',
  },
} as const satisfies Record<SharedKind, Record<string, string>>;

/**
 * The people a playlist or a private song is shared with (D126): each with what they may do,
 * which the owner changes on the spot, and takes them out with one tap and back with one more
 * (D87); then the owner's two invite links. Anyone in it sees who else is.
 */
export function SharePeople({
  kind,
  id,
  isOwner,
}: {
  kind: SharedKind;
  id: number;
  isOwner: boolean;
}) {
  const { t } = useI18n();
  const text = TEXT[kind];
  const utils = trpc.useUtils();
  const thing = { kind, id };
  const members = trpc.sharing.members.useQuery(thing);
  const remove = trpc.sharing.removeMember.useMutation();
  const setRole = trpc.sharing.setRole.useMutation({
    onSuccess: () => utils.sharing.members.invalidate(thing),
  });
  // Taken out while the dialog is open: they stay in the list, greyed, with the way back
  // where the keyboard can reach it. Closing the dialog hands that over to a toast (D87).
  const [removed, setRemoved] = useState<Person[]>([]);
  const people = useRef<HTMLDivElement>(null);

  const restore = async (person: Person) => {
    putShared(
      await trpcClient.sharing.restoreMember.mutate({ ...thing, userId: person.id }),
    );
    await utils.sharing.members.invalidate(thing);
  };
  const removePerson = (person: Person) =>
    remove.mutate(
      { ...thing, userId: person.id },
      {
        onSuccess: async (record) => {
          putShared(record);
          setRemoved((list) => [...list, person]);
          await utils.sharing.members.invalidate(thing);
          refocusWithin(people.current);
        },
      },
    );
  // The dialog closing unmounts this: whoever is still out gets their undo in a toast.
  const stillOut = useRef(removed);
  stillOut.current = removed;
  const restoreLater = useRef(restore);
  restoreLater.current = restore;
  useEffect(
    () => () => {
      for (const person of stillOut.current) {
        showUndoToast({
          id: `removed-${kind}-${id}-${person.id}`,
          message: t('playlists.removed', { name: person.displayName }),
          onUndo: () => restoreLater.current(person),
        });
      }
    },
    [kind, id, t],
  );

  const shown = members.data?.filter((p) => !removed.some((r) => r.id === p.id));
  return (
    <ShareSection
      title={t(text.people)}
      intro={isOwner ? t(text.peopleIntroOwner) : t(text.peopleIntro)}
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
              {/* One line each: the name (wrapped rather than cut off beside the owner's
                  picker), then what they may do. The owner changes it on the spot, and has
                  the × to take them out. */}
              <Text fw={500} miw={0} style={{ overflowWrap: 'anywhere' }}>
                {person.displayName}
              </Text>
              {person.role !== 'owner' && isOwner ? (
                <Group gap={4} wrap="nowrap">
                  {/* The device's own picker, as for roles in the account. */}
                  <NativeSelect
                    size="sm"
                    w={160}
                    aria-label={t('playlists.roleOf', { name: person.displayName })}
                    value={person.role}
                    disabled={
                      setRole.isPending && setRole.variables?.userId === person.id
                    }
                    data={JOIN_ROLES.map((role) => ({
                      value: role,
                      label: t(`playlists.role.${role}`),
                    }))}
                    onChange={(e) =>
                      setRole.mutate({
                        ...thing,
                        userId: person.id,
                        role: e.currentTarget.value as JoinRole,
                      })
                    }
                  />
                  <IconButton
                    label={t('playlists.removePerson', { name: person.displayName })}
                    loading={remove.isPending && remove.variables?.userId === person.id}
                    onClick={() => removePerson(person)}
                  >
                    <IconX size={18} />
                  </IconButton>
                </Group>
              ) : (
                <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                  {t(`playlists.role.${person.role}`)}
                </Text>
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
      <ErrorText error={members.error ?? remove.error ?? setRole.error} />

      {isOwner && (
        <Stack gap="lg" mt="lg">
          {JOIN_ROLES.map((role) => (
            <InviteLink
              key={role}
              kind={kind}
              id={id}
              role={role}
              intro={t(
                role === 'collaborator' ? text.collaboratorInvite : text.viewerInvite,
              )}
            />
          ))}
        </Stack>
      )}
    </ShareSection>
  );
}

const INVITE_TITLE = {
  collaborator: 'playlists.inviteTitle',
  viewer: 'playlists.viewInviteTitle',
} as const;

/**
 * The owner's invite link for one role, asked for (and made, the first time) as the dialog
 * opens, and replaced on its own.
 */
function InviteLink({
  kind,
  id,
  role,
  intro,
}: {
  kind: SharedKind;
  id: number;
  role: JoinRole;
  intro: string;
}) {
  const { t } = useI18n();
  const invite = trpc.sharing.invite.useMutation();
  const reset = trpc.sharing.resetInvite.useMutation();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const { mutate: askForInvite } = invite;
  useEffect(() => {
    askForInvite({ kind, id, role });
  }, [askForInvite, kind, id, role]);
  // A replaced link is the newer one.
  const token = reset.data?.token ?? invite.data?.token;
  const link = token ? `${window.location.origin}${url.join(token)}` : '';
  const title = t(INVITE_TITLE[role]);
  return (
    <Stack gap="xs">
      <LinkField
        icon={editsAsMember(role) ? <IconPencil size={16} /> : <IconBook size={16} />}
        label={title}
        description={intro}
        link={link}
        loading={invite.isPending}
        extra={
          // The old link stops working for everyone it was sent to: asked first, right where
          // it was tapped.
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
                aria-label={t('playlists.resetLink', { link: title })}
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
                        { kind, id, role },
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
  );
}

/**
 * A link to hand on, read only, named by what it gives (an eye to look, a pencil to edit), with
 * a copy button inside the field and any other action beside it.
 */
export function LinkField({
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

export function ShareSection({
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
