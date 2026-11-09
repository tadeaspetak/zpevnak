import {
  ActionIcon,
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
import { IconCheck, IconTrash, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { REJECTION_REASONS, type RejectionReason } from '#shared/validators/index.ts';
import { DeleteSongModal } from '../components/DeleteSongModal.tsx';
import { ErrorText } from '../components/ErrorText.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { putSong, syncCatalog } from '../data/catalog.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { ChordProEditor } from '../song/ChordProEditor.tsx';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';
import classes from './ReviewPage.module.css';

/**
 * An editor's review of one song: fix the ChordPro right here, then verify or reject.
 * After either, the next pending song opens, so a queue is worked through in one sitting.
 */
export function ReviewPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const id = Number(useParams().id);
  const { me, isEditor, known } = useMe();
  const utils = trpc.useUtils();
  const song = trpc.songs.byId.useQuery({ id }, { enabled: isEditor });
  const pending = trpc.songs.queue.useQuery({ status: 'pending' }, { enabled: isEditor });
  const [source, setSource] = useState<string | null>(null);
  const [rejecting, { open: openReject, close: closeReject }] = useDisclosure(false);
  const [deleting, { open: openDelete, close: closeDelete }] = useDisclosure(false);

  const goToNext = async () => {
    setSource(null);
    await utils.songs.queue.invalidate();
    const queue = await utils.songs.queue.fetch({ status: 'pending' });
    const next = queue.find((s) => s.id !== id);
    navigate(next ? url.review(next.id) : url.queue(), { replace: true });
  };
  const done = async (saved: Parameters<typeof putSong>[0], message: string) => {
    putSong(saved);
    // A rejected song leaves everyone else's catalog; the sync tells this device too.
    void syncCatalog(me?.id ?? null);
    notifications.show({ message, icon: <IconCheck size={16} /> });
    await goToNext();
  };

  const save = trpc.songs.update.useMutation({
    onSuccess: (saved) => {
      putSong(saved);
      setSource(null);
      void utils.songs.byId.invalidate({ id });
      notifications.show({ message: t('common.saved') });
    },
  });
  const verify = trpc.songs.verify.useMutation({
    onSuccess: (saved) => done(saved, t('queue.verified')),
  });
  const reject = trpc.songs.reject.useMutation({
    onSuccess: (saved) => {
      closeReject();
      return done(saved, t('queue.rejectedToast'));
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

  const current = source ?? song.data.source;
  const dirty = source !== null && source !== song.data.source;
  const position = pending.data ? pending.data.findIndex((s) => s.id === id) + 1 : 0;

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
      <Container size="80rem" px="md" py="md">
        <Stack gap="sm">
          <Group gap="xs">
            <StatusBadge status={song.data.status} />
            {song.data.rejection && (
              <Text size="sm" c="dimmed">
                {t(`reason.${song.data.rejection.reason}`)}
                {song.data.rejection.note && `: ${song.data.rejection.note}`}
              </Text>
            )}
          </Group>
          <ErrorText error={save.error ?? verify.error ?? reject.error} />
          <ChordProEditor value={current} onChange={setSource} />
          {/* All decisions together, bottom right, the primary last; the bar stays on
              screen, so a long song never hides them. */}
          <Group justify="flex-end" gap="xs" className={classes.actions}>
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
              onClick={() => save.mutate({ id, source: current })}
            >
              {t('common.save')}
            </Button>
            <Button
              leftSection={<IconCheck size={16} />}
              loading={verify.isPending}
              onClick={() => verify.mutate({ id, source: dirty ? current : undefined })}
            >
              {dirty ? t('queue.saveAndVerify') : t('queue.verify')}
            </Button>
          </Group>
        </Stack>
      </Container>
      <RejectModal
        opened={rejecting}
        onClose={closeReject}
        loading={reject.isPending}
        onReject={(reason, note) => reject.mutate({ id, reason, note })}
      />
    </>
  );
}

function RejectModal(props: {
  opened: boolean;
  onClose: () => void;
  loading: boolean;
  onReject: (reason: RejectionReason, note: string) => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState<RejectionReason>('too_many_mistakes');
  const [note, setNote] = useState('');
  return (
    <Modal opened={props.opened} onClose={props.onClose} title={t('queue.rejectTitle')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          props.onReject(reason, note);
        }}
      >
        <Stack>
          <Radio.Group
            label={t('queue.reason')}
            value={reason}
            onChange={(v) => setReason(v as RejectionReason)}
          >
            <Stack gap="xs" mt="xs">
              {REJECTION_REASONS.map((r) => (
                <Radio key={r} value={r} label={t(`reason.${r}`)} />
              ))}
            </Stack>
          </Radio.Group>
          <Textarea
            label={t('queue.note')}
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            autosize
            minRows={2}
            maxLength={1000}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={props.onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" color="red" loading={props.loading}>
              {t('queue.reject')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
