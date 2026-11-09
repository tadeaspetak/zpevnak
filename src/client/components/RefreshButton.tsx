import { ActionIcon, Tooltip } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import { putPlaylist, syncCatalog, useCatalog } from '../data/catalog.ts';
import { useMe } from '../hooks/useMe.ts';
import { useOnline } from '../hooks/useOnline.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import classes from './RefreshButton.module.css';

/**
 * Fetches what others changed: the catalog, and on a playlist's page that playlist too. The
 * way to see a bandmate's change without reloading, and the only way at all in an app installed
 * to the home screen, which has no reload (D74). Stays where you are; offline, it waits.
 */
export function RefreshButton({ playlistId }: { playlistId?: number }) {
  const { t } = useI18n();
  const { me } = useMe();
  const online = useOnline();
  const { syncing } = useCatalog();
  const utils = trpc.useUtils();
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      await Promise.all([
        syncCatalog(me?.id ?? null),
        playlistId
          ? utils.playlists.byId
              .fetch({ id: playlistId }, { staleTime: 0 })
              .then((p) => putPlaylist(p.id, p))
              .catch((error: unknown) => {
                // Deleted, made private, or the viewer was taken out: it leaves the device.
                if ((error as { message?: string }).message === 'NOT_FOUND') {
                  putPlaylist(playlistId, null);
                }
              })
          : null,
      ]);
    } finally {
      setBusy(false);
    }
  };

  const spinning = busy || syncing;
  return (
    <Tooltip label={online ? t('refresh.label') : t('common.offline')}>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        onClick={refresh}
        disabled={!online}
        aria-label={t('refresh.label')}
        aria-busy={spinning}
      >
        <IconRefresh
          size={20}
          className={classes.icon}
          data-spinning={spinning || undefined}
        />
      </ActionIcon>
    </Tooltip>
  );
}
