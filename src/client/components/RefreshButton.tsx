import { Button } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import { checkForAppUpdate } from '../appUpdate.ts';
import { putPlaylist, syncCatalog, useCatalog } from '../data/catalog.ts';
import { useMe } from '../hooks/useMe.ts';
import { useOnline } from '../hooks/useOnline.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import classes from './RefreshButton.module.css';
import { IconButton } from './IconButton.tsx';

/**
 * Fetches what others changed: the catalog, and with a playlist that playlist too; and asks
 * whether the app itself has a new version (D75), which reloads onto it. The way to see a
 * bandmate's change without reloading, and the only way at all in an app installed to the home
 * screen, which has no reload (D74). Otherwise stays where you are; offline, it waits.
 */
function useRefresh(playlistId: number | undefined) {
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
        checkForAppUpdate(),
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
  return { refresh, online, spinning: busy || syncing };
}

function RefreshIcon({ spinning, size }: { spinning: boolean; size: number }) {
  return (
    <IconRefresh
      size={size}
      className={classes.icon}
      data-spinning={spinning || undefined}
    />
  );
}

/** The icon, where fresh changes matter most: a playlist's page, before a gig. */
export function RefreshButton({ playlistId }: { playlistId?: number }) {
  const { t } = useI18n();
  const { refresh, online, spinning } = useRefresh(playlistId);
  return (
    <IconButton
      label={t('refresh.label')}
      tooltip={online ? t('refresh.label') : t('common.offline')}
      onClick={refresh}
      disabled={!online}
      aria-busy={spinning}
    >
      <RefreshIcon spinning={spinning} size={20} />
    </IconButton>
  );
}

/** The same as a full button, in the settings on every page. */
export function RefreshAction({ playlistId }: { playlistId?: number }) {
  const { t } = useI18n();
  const { refresh, online, spinning } = useRefresh(playlistId);
  return (
    <Button
      variant="default"
      fullWidth
      onClick={refresh}
      disabled={!online}
      aria-busy={spinning}
      leftSection={<RefreshIcon spinning={spinning} size={18} />}
    >
      {online ? t('refresh.label') : t('common.offline')}
    </Button>
  );
}
