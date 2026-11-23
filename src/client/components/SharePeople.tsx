import {
  ActionIcon,
  Button,
  SegmentedControl,
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
  IconDoorExit,
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
import { useMe } from '../hooks/useMe.ts';
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
    peopleIntroViewer: 'playlists.peopleIntroViewer',
    collaboratorInvite: 'playlists.inviteIntro',
    viewerInvite: 'playlists.viewInviteIntro',
    removed: 'playlists.removed',
  },
  song: {
    people: 'songs.people',
    peopleIntro: 'songs.peopleIntro',
    peopleIntroOwner: 'songs.peopleIntroOwner',
    peopleIntroViewer: 'songs.peopleIntroViewer',
    collaboratorInvite: 'songs.inviteIntro',
    viewerInvite: 'songs.viewInviteIntro',
    removed: 'songs.removed',
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
  const { me } = useMe();
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
  // Where the keyboard goes once a row has changed under it: never to the next person's ×,
  // where a second Enter would take them out too.
  const focusOn = (selector: string) =>
    requestAnimationFrame(() => {
      const target = people.current?.querySelector<HTMLElement>(selector);
      if (target) {
        target.focus();
      } else {
        refocusWithin(people.current);
      }
    });

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
          focusOn(`[data-undo-for="${person.id}"] button`);
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
          message: t(TEXT[kind].removed, { name: person.displayName }),
          onUndo: () => restoreLater.current(person),
        });
      }
    },
    [kind, id, t],
  );

  const shown = members.data?.filter((p) => !removed.some((r) => r.id === p.id));
  const myRole = members.data?.find((p) => p.id === me?.id)?.role;
  return (
    <ShareSection
      title={t(text.people)}
      intro={t(
        isOwner
          ? text.peopleIntroOwner
          : myRole === 'viewer'
            ? text.peopleIntroViewer
            : text.peopleIntro,
      )}
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
              <Text fw={500} miw={0} style={{ overflowWrap: 'break-word' }}>
                {person.displayName}
                {/* Among the others, themselves. */}
                {person.id === me?.id && (
                  <Text span c="dimmed" fw={400}>
                    {' '}
                    {t('sharing.you')}
                  </Text>
                )}
              </Text>
              {person.role !== 'owner' && isOwner ? (
                <Group gap={4} wrap="nowrap">
                  {/* The device's own picker, as for roles in the account. */}
                  <NativeSelect
                    size="sm"
                    w={160}
                    aria-label={t('sharing.roleOf', { name: person.displayName })}
                    data-role-of={person.id}
                    value={person.role}
                    disabled={
                      setRole.isPending && setRole.variables?.userId === person.id
                    }
                    data={JOIN_ROLES.map((role) => ({
                      value: role,
                      label: t(`sharing.role.${role}`),
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
                    label={t('sharing.removePerson', { name: person.displayName })}
                    loading={remove.isPending && remove.variables?.userId === person.id}
                    onClick={() => removePerson(person)}
                  >
                    <IconX size={18} />
                  </IconButton>
                </Group>
              ) : (
                <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                  {t(`sharing.role.${person.role}`)}
                </Text>
              )}
            </Group>
          ))}
        </Paper>
      )}
      {removed.map((person) => (
        <div key={person.id} data-undo-for={person.id}>
          <UndoMessage
            message={t(text.removed, { name: person.displayName })}
            onUndo={async () => {
              await restore(person);
              setRemoved((list) => list.filter((r) => r.id !== person.id));
              focusOn(`[data-role-of="${person.id}"]`);
            }}
          />
        </div>
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
  collaborator: 'sharing.inviteTitle',
  viewer: 'sharing.viewInviteTitle',
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
                aria-label={t('sharing.resetLink', { link: title })}
                onClick={() => setConfirmingReset((o) => !o)}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="xs">
                <Text size="sm">{t('sharing.resetHint')}</Text>
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
                    {t('sharing.resetConfirm')}
                  </Button>
                </Group>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        }
      />
      {reset.isSuccess && (
        <Text size="sm" fw={600} role="status">
          {t('sharing.resetDone')}
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
                <Tooltip label={copied ? t('sharing.copied') : t('sharing.copyLink')}>
                  <ActionIcon
                    size="lg"
                    onClick={copy}
                    disabled={!link}
                    aria-label={t('sharing.copyLink')}
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

type Visibility = 'private' | 'public';

/**
 * Who sees it, private or public, each choice saying what it means. Someone who may not change
 * it sees the same, unable to; a choice that isn't open stays visible, greyed.
 */
export function VisibilitySwitch({
  label,
  value,
  readOnly,
  onChange,
  choices,
}: {
  label: string;
  value: Visibility;
  readOnly: boolean;
  onChange: (value: Visibility) => void;
  choices: Record<Visibility, { name: string; what: string; disabled?: boolean }>;
}) {
  return (
    <SegmentedControl
      fullWidth
      readOnly={readOnly}
      aria-label={label}
      value={value}
      onChange={(v) => onChange(v as Visibility)}
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
      data={(['private', 'public'] as const).map((v) => ({
        value: v,
        disabled: choices[v].disabled,
        label: (
          <Stack gap={0}>
            <Text size="sm" fw={600}>
              {choices[v].name}
            </Text>
            <Text size="xs" c="dimmed" lh={1.3}>
              {choices[v].what}
            </Text>
          </Stack>
        ),
      }))}
    />
  );
}

/**
 * Leaving something shared with you, asked once more where it was tapped. `onLeft` puts the
 * catalog and the page right: what's private is gone, what's public stays, no longer yours.
 */
export function LeaveButton({
  kind,
  id,
  label,
  confirm,
  onLeft,
}: {
  kind: SharedKind;
  id: number;
  label: string;
  confirm: string;
  onLeft: () => void;
}) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const leave = trpc.sharing.leave.useMutation({ onSuccess: onLeft });
  if (!confirming) {
    return (
      <Button
        variant="outline"
        color="red"
        leftSection={<IconDoorExit size={16} />}
        onClick={() => setConfirming(true)}
      >
        {label}
      </Button>
    );
  }
  return (
    <Stack gap="xs">
      <Text size="sm">{confirm}</Text>
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={() => setConfirming(false)}>
          {t('common.cancel')}
        </Button>
        <Button
          color="red"
          loading={leave.isPending}
          onClick={() => leave.mutate({ kind, id })}
        >
          {label}
        </Button>
      </Group>
      <ErrorText error={leave.error} />
    </Stack>
  );
}
