import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconWorld } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ErrorText } from '../components/ErrorText.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { putPlaylist, useCatalog } from '../data/catalog.ts';
import { usePlayer } from '../data/session.ts';
import type { PlaylistRecord } from '../data/store.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';
import rowClasses from '../components/SongRow.module.css';

export function PlaylistsPage() {
  const { t } = useI18n();
  const { me } = useMe();
  const { playlists } = useCatalog();
  const { recentPlaylists } = usePlayer();
  const [creating, { open, close }] = useDisclosure(false);

  // Most recently played first, then most recently changed.
  const sorted = useMemo(
    () =>
      [...playlists.values()].sort(
        (a, b) =>
          (recentPlaylists[b.id] ?? 0) - (recentPlaylists[a.id] ?? 0) ||
          b.updatedAt.localeCompare(a.updatedAt),
      ),
    [playlists, recentPlaylists],
  );
  const mine = sorted.filter((p) => p.isMine);
  const others = sorted.filter((p) => !p.isMine);

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
      <Page>
        <Stack gap="lg">
          {me ? (
            <section>
              <Title order={2} size="h5" mb={4}>
                {t('playlists.mine')}
              </Title>
              {mine.length === 0 ? (
                <Text c="dimmed">{t('playlists.noneMine')}</Text>
              ) : (
                <PlaylistList playlists={mine} />
              )}
            </section>
          ) : (
            <Alert variant="light" color="gray">
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
          <section>
            <Title order={2} size="h5" mb={4}>
              {t('playlists.public')}
            </Title>
            {others.length === 0 ? (
              <Text c="dimmed">{t('playlists.none')}</Text>
            ) : (
              <PlaylistList playlists={others} />
            )}
          </section>
        </Stack>
      </Page>
      <NewPlaylistModal opened={creating} onClose={close} />
    </>
  );
}

function PlaylistList({ playlists }: { playlists: PlaylistRecord[] }) {
  const { t, tn } = useI18n();
  return (
    <Stack gap={0} mx="-md">
      {playlists.map((p) => (
        <UnstyledButton
          key={p.id}
          component={Link}
          to={url.playlist(p.id)}
          className={rowClasses.row}
        >
          <Group gap={6} wrap="nowrap">
            <Text fw={600} truncate>
              {p.name}
            </Text>
            {p.isMine && p.isPublic && (
              <IconWorld size={14} aria-label={t('common.public')} />
            )}
          </Group>
          <Text size="sm" c="dimmed">
            {tn('common.songs', p.songIds.length)}
            {!p.isMine && ` · ${t('playlists.by', { name: p.ownerName })}`}
          </Text>
        </UnstyledButton>
      ))}
    </Stack>
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
      onClose();
      navigate(url.playlist(playlist.id));
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
          <Button type="submit" loading={create.isPending}>
            {t('playlists.create')}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
