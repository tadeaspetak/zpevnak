import { Button, CopyButton } from '@mantine/core';
import { IconCheck, IconCopy, IconShare } from '@tabler/icons-react';
import { useI18n } from '../i18n/index.tsx';

/**
 * Hands a link on: the phone's own share sheet where there is one (straight into the band's
 * chat), else a copy to paste.
 */
export function ShareLinkButton({
  link,
  title,
  copyLabel,
  sendLabel,
  variant = 'filled',
}: {
  link: string;
  /** What the share sheet says it is: the playlist's name. */
  title: string;
  copyLabel: string;
  sendLabel: string;
  variant?: 'filled' | 'default';
}) {
  const { t } = useI18n();
  if (typeof navigator.share === 'function') {
    return (
      <Button
        variant={variant}
        disabled={!link}
        leftSection={<IconShare size={16} />}
        onClick={() => {
          // Closing the share sheet rejects: nothing to say about that.
          navigator.share({ title, url: link }).catch(() => {});
        }}
      >
        {sendLabel}
      </Button>
    );
  }
  return (
    <CopyButton value={link}>
      {({ copied, copy }) => (
        <Button
          variant={variant}
          onClick={copy}
          disabled={!link}
          leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
        >
          {copied ? t('playlists.copied') : copyLabel}
        </Button>
      )}
    </CopyButton>
  );
}
