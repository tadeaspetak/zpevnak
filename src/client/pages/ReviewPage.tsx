import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Radio,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconHistory,
  IconPlayerTrackNext,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { type ReactNode, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { REJECTION_REASONS, type RejectionReason } from '#shared/validators/index.ts';
import { DeleteSongModal } from '../components/DeleteSongModal.tsx';
import { ErrorText } from '../components/ErrorText.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { putSong, syncCatalog, useCatalog } from '../data/catalog.ts';
import { nextInQueue } from '../data/nextInQueue.ts';
import { reviewContext } from '../data/reviewContext.ts';
import { useDraft } from '../hooks/useDraft.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { ChordProEditor, type ChordProEditorHandle } from '../song/ChordProEditor.tsx';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';

/**
 * An editor's review of one song: fix the ChordPro right here, then verify or reject.
 * After either, or a skip, the song that followed it opens, so a queue is worked through in one
 * sitting, and a song put off for later comes round again only after the rest.
 */
export function ReviewPage() {
  const i18n = useI18n();
  const { t, formatDate } = i18n;
  const { playlists } = useCatalog();
  const navigate = useNavigate();
  const id = Number(useParams().id);
  const { me, isEditor, known } = useMe();
  const utils = trpc.useUtils();
  const song = trpc.songs.byId.useQuery({ id }, { enabled: isEditor });
  const pending = trpc.songs.queue.useQuery({ status: 'pending' }, { enabled: isEditor });
  const draft = useDraft(`review:${id}`, song.data?.source);
  const editor = useRef<ChordProEditorHandle>(null);
  const [rejecting, { open: openReject, close: closeReject }] = useDisclosure(false);
  const [deleting, { open: openDelete, close: closeDelete }] = useDisclosure(false);

  const goToNext = async () => {
    // The queue as the editor saw it: where they are in it decides what comes next.
    const seen = (pending.data ?? []).map((s) => s.id);
    await utils.songs.queue.invalidate();
    const queue = await utils.songs.queue.fetch({ status: 'pending' });
    const next = nextInQueue(
      seen,
      queue.map((s) => s.id),
      id,
    );
    navigate(next === null ? url.queue() : url.review(next), { replace: true });
  };
  const done = async (
    saved: Parameters<typeof putSong>[0],
    message: string,
    icon: ReactNode,
    color: 'green' | 'red',
  ) => {
    putSong(saved);
    draft.clear();
    // A rejected song leaves everyone else's catalog; the sync tells this device too.
    void syncCatalog(me?.id ?? null);
    notifications.show({ message, icon, color });
    await goToNext();
  };

  const save = trpc.songs.update.useMutation({
    onSuccess: (saved) => {
      putSong(saved);
      draft.clear();
      void utils.songs.byId.invalidate({ id });
      notifications.show({ message: t('common.saved') });
    },
  });
  const verify = trpc.songs.verify.useMutation({
    onSuccess: (saved) =>
      done(
        saved,
        t('queue.verifiedToast', { title: saved.title }),
        <IconCheck size={16} />,
        'green',
      ),
  });
  const reject = trpc.songs.reject.useMutation({
    onSuccess: (saved) => {
      closeReject();
      return done(
        saved,
        t('queue.rejectedToast', { title: saved.title }),
        <IconX size={16} />,
        'red',
      );
    },
  });

  if (known && !isEditor) {
    return <Navigate to={url.home()} replace />;
  }
  if (!song.data) {
    return (
      <>
        <PageHeader
          width="80rem"
          title={t('queue.title')}
          backTo={url.queue()}
          backLabel={t('nav.backTo', { name: t('queue.title') })}
        />
        <Container py="md">
          <ErrorText error={song.error} />
        </Container>
      </>
    );
  }

  const current = draft.source ?? song.data.source;
  const dirty = draft.dirty;
  const position = pending.data ? pending.data.findIndex((s) => s.id === id) + 1 : 0;
  const entry = pending.data?.[position - 1];

  return (
    <>
      <PageHeader
        width="80rem"
        title={song.data.title}
        backTo={url.queue()}
        backLabel={t('nav.backTo', { name: t('queue.title') })}
        actions={
          <>
            {position > 0 && (
              <Badge variant="default" size="lg">
                {position} / {pending.data?.length}
              </Badge>
            )}
            {position > 0 && (pending.data?.length ?? 0) > 1 && (
              <Tooltip label={t('queue.skip')}>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  onClick={() => void goToNext()}
                  aria-label={t('queue.skip')}
                >
                  <IconPlayerTrackNext size={20} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label={t('song.delete')}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                onClick={openDelete}
                aria-label={t('song.delete')}
              >
                <IconTrash size={20} />
              </ActionIcon>
            </Tooltip>
          </>
        }
      />
      <DeleteSongModal
        song={song.data}
        opened={deleting}
        onClose={closeDelete}
        then={url.queue()}
      />
      <Container size="80rem" px="md" pt="md">
        <Stack gap="sm">
          <Group gap="xs">
            <StatusBadge status={song.data.status} />
            {entry && (
              <Text size="sm" c="dimmed">
                {[
                  entry.authorName && t('queue.addedBy', { name: entry.authorName }),
                  formatDate(entry.createdAt),
                  ...reviewContext(entry.id, null, playlists.values(), i18n),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            )}
            {song.data.rejection && (
              <Text size="sm" c="dimmed">
                {t(`reason.${song.data.rejection.reason}`)}
                {song.data.rejection.note && `: ${song.data.rejection.note}`}
              </Text>
            )}
          </Group>
          {entry?.lastRejection && (
            <Alert
              variant="default"
              icon={<IconHistory size={18} />}
              title={t('queue.lastRejection', {
                reason: t(`reason.${entry.lastRejection.reason}`),
              })}
            >
              {entry.lastRejection.note && (
                <Text size="sm">{entry.lastRejection.note}</Text>
              )}
            </Alert>
          )}
          <ErrorText error={save.error ?? verify.error ?? reject.error} />
          <ChordProEditor
            ref={editor}
            value={current}
            onChange={draft.setSource}
            onDiscardDraft={draft.restored ? draft.clear : undefined}
            actions={
              <>
                <Button
                  variant="outline"
                  color="red"
                  leftSection={<IconX size={16} />}
                  onClick={openReject}
                  disabled={song.data.status === 'rejected'}
                >
                  {t('queue.reject')}
                </Button>
                <Button
                  variant="default"
                  disabled={!dirty}
                  loading={save.isPending}
                  onClick={() => {
                    if (editor.current?.checkTitle()) {
                      save.mutate({ id, source: current });
                    }
                  }}
                >
                  {t('common.save')}
                </Button>
                <Button
                  leftSection={<IconCheck size={16} />}
                  loading={verify.isPending}
                  onClick={() => {
                    if (editor.current?.checkTitle()) {
                      verify.mutate({ id, source: dirty ? current : undefined });
                    }
                  }}
                >
                  {dirty ? t('queue.saveAndVerify') : t('queue.verify')}
                </Button>
              </>
            }
          />
        </Stack>
      </Container>
      <RejectModal
        key={id}
        opened={rejecting}
        onClose={closeReject}
        loading={reject.isPending}
        dropsEdits={dirty}
        onReject={(reason, note) => reject.mutate({ id, reason, note })}
      />
    </>
  );
}

function RejectModal(props: {
  opened: boolean;
  onClose: () => void;
  loading: boolean;
  /** The editor changed the text: rejecting doesn't keep it. */
  dropsEdits: boolean;
  onReject: (reason: RejectionReason, note: string) => void;
}) {
  const { t } = useI18n();
  // Nothing chosen for the editor: a reason picked by default is a reason nobody gave.
  const [reason, setReason] = useState<RejectionReason | null>(null);
  const [note, setNote] = useState('');
  // "Other" says nothing by itself: the note is the reason.
  const needsNote = reason === 'other';
  const ready = reason !== null && (!needsNote || note.trim() !== '');
  return (
    <Modal opened={props.opened} onClose={props.onClose} title={t('queue.rejectTitle')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (reason && ready) {
            props.onReject(reason, note);
          }
        }}
      >
        <Stack>
          <Radio.Group
            label={t('queue.reason')}
            value={reason ?? ''}
            onChange={(v) => setReason(v as RejectionReason)}
          >
            <Stack gap="xs" mt="xs">
              {REJECTION_REASONS.map((r) => (
                <Radio key={r} value={r} label={t(`reason.${r}`)} />
              ))}
            </Stack>
          </Radio.Group>
          <Textarea
            label={needsNote ? t('queue.noteRequired') : t('queue.note')}
            required={needsNote}
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            autosize
            minRows={2}
            maxLength={1000}
          />
          {props.dropsEdits && (
            <Text size="sm" c="dimmed">
              {t('queue.rejectDropsEdits')}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={props.onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" color="red" loading={props.loading} disabled={!ready}>
              {t('queue.reject')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
