import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ErrorText } from '../components/ErrorText.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { PageLoader } from '../components/PageLoader.tsx';
import { PlaylistRow } from '../components/PlaylistRow.tsx';
import { putPlaylist, useCatalog } from '../data/catalog.ts';
import { useOnline } from '../hooks/useOnline.ts';
import { groupPlaylists } from '../data/playlistFacts.ts';
import { ListSection } from '../components/ListSection.tsx';
import { touchPlaylist, usePlayer } from '../data/session.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { url } from '#shared/urls.ts';

/**
 * Every playlist the viewer can open, by whose it is (D112): their own, those shared with them,
 * and everyone else's public ones; in each, the most recently played first.
 */
export function PlaylistsPage() {
  const { t } = useI18n();
  const { me } = useMe();
  const { playlists, loaded, synced } = useCatalog();
  const online = useOnline();
  const { recentPlaylists } = usePlayer();
  const [creating, { open, close }] = useDisclosure(false);

  const { mine, shared, others } = useMemo(
    () => groupPlaylists(playlists.values(), recentPlaylists),
    [playlists, recentPlaylists],
  );
  const sections = [
    { title: t('playlists.mine'), list: mine },
    { title: t('playlists.sharedWithMe'), list: shared },
    { title: t('playlists.public'), list: others },
  ].filter((section) => section.list.length > 0);

  return (
    <>
      <PageHeader
        title={t('playlists.title')}
        backTo={url.home()}
        backLabel={t('nav.backHome')}
        actions={
          me?.emailVerified && (
            <Button size="sm" leftSection={<IconPlus size={16} />} onClick={open}>
              {t('playlists.new')}
            </Button>
          )
        }
      />
      <Page pill>
        <Stack gap="lg">
          {!me && (
            <Alert>
              <Group justify="space-between">
                <Text size="sm">{t('playlists.signInToCreate')}</Text>
                <Button
                  component={Link}
                  to={url.logIn(url.playlists())}
                  size="sm"
                  variant="default"
                >
                  {t('nav.logIn')}
                </Button>
              </Group>
            </Alert>
          )}
          {/* A new device: nothing to show until the first sync, which isn't "no playlists". */}
          {!loaded || (!synced && playlists.size === 0 && online) ? (
            <PageLoader />
          ) : sections.length === 0 ? (
            <Text c="dimmed">{t('playlists.none')}</Text>
          ) : (
            sections.map((section) => (
              <ListSection key={section.title} title={section.title}>
                {section.list.map((p) => (
                  <PlaylistRow key={p.id} playlist={p} />
                ))}
              </ListSection>
            ))
          )}
        </Stack>
      </Page>
      <NewPlaylistModal opened={creating} onClose={close} />
    </>
  );
}

function NewPlaylistModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const create = trpc.playlists.create.useMutation({
    onSuccess: (playlist) => {
      putPlaylist(playlist.id, playlist);
      touchPlaylist(playlist.id);
      onClose();
      navigate(url.playlist(playlist));
    },
  });
  return (
    <Modal opened={opened} onClose={onClose} title={t('playlists.new')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name, isPublic, songIds: [] });
        }}
      >
        <Stack>
          <ErrorText error={create.error} />
          <TextInput
            label={t('playlists.name')}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
            data-autofocus
          />
          <Switch
            label={t('playlists.isPublic')}
            checked={isPublic}
            onChange={(e) => setIsPublic(e.currentTarget.checked)}
          />
          {/* The server trims the name: a name of spaces is no name. */}
          <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
            {t('playlists.create')}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
