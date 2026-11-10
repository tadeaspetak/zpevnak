import { Button, Group, Modal, Radio, Stack, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { REJECTION_REASONS, type RejectionReason } from '#shared/validators/index.ts';
import { useI18n } from '../i18n/index.tsx';
import { ErrorText } from './ErrorText.tsx';

/**
 * Why a song is turned down: one of the reasons, chosen (none is preselected), and for "other"
 * a note, which then is the reason (D101). The author gets both by email (D100).
 */
export function RejectModal(props: {
  opened: boolean;
  onClose: () => void;
  loading: boolean;
  error: unknown;
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
          <ErrorText error={props.error} />
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
