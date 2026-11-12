import { Button } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import { checkForAppUpdate } from '../appUpdate.ts';
import { putPlaylist, syncCatalog, useCatalog } from '../data/catalog.ts';
import { useMe } from '../hooks/useMe.ts';
import { useOnline } from '../hooks/useOnline.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import classes from './RefreshAction.module.css';

/**
 * "Načíst novinky", in the settings on every page (D116, D117). Fetches what others changed: the
 * catalog, and the given playlists too; and asks whether the app itself has a new version (D75),
 * which reloads onto it. The way to see a bandmate's change without reloading, and the only way
 * at all in an app installed to the home screen, which has no reload (D74). Otherwise stays
 * where you are; offline, it waits.
 */
export function RefreshAction({ playlistIds }: { playlistIds: number[] }) {
  const { t } = useI18n();
  const { me } = useMe();
  const online = useOnline();
  const { syncing } = useCatalog();
  const utils = trpc.useUtils();
  const [busy, setBusy] = useState(false);
  const spinning = busy || syncing;

  const refresh = async () => {
    setBusy(true);
    try {
      await Promise.all([
        syncCatalog(me?.id ?? null),
        checkForAppUpdate(),
        ...playlistIds.map((id) =>
          utils.playlists.byId
            .fetch({ id }, { staleTime: 0 })
            .then((p) => putPlaylist(p.id, p))
            .catch((error: unknown) => {
              // Deleted, made private, or the viewer was taken out: it leaves the device.
              if ((error as { message?: string }).message === 'NOT_FOUND') {
                putPlaylist(id, null);
              }
            }),
        ),
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="default"
      fullWidth
      onClick={refresh}
      disabled={!online}
      aria-busy={spinning}
      leftSection={
        <IconRefresh
          size={18}
          className={classes.icon}
          data-spinning={spinning || undefined}
        />
      }
    >
      {online ? t('refresh.label') : t('common.offline')}
    </Button>
  );
}
