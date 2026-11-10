import {
  Alert,
  Anchor,
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  Table,
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
import { PlaylistRow } from '../components/PlaylistRow.tsx';
import { putPlaylist, useCatalog } from '../data/catalog.ts';
import { playlistFacts } from '../data/playlistFacts.ts';
import { usePlayer } from '../data/session.ts';
import { usePhone } from '../hooks/useBreakpoints.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';
import classes from './PlaylistsPage.module.css';

/**
 * Every playlist the viewer can open, in one list: their own, those they collaborate on, and
 * everyone else's public ones, most recently played first. A table where it fits; on a phone,
 * rows with the same facts under the name.
 */
export function PlaylistsPage() {
  const { t, tn } = useI18n();
  const navigate = useNavigate();
  const { me } = useMe();
  const { playlists } = useCatalog();
  const { recentPlaylists } = usePlayer();
  const wide = !usePhone();
  const [creating, { open, close }] = useDisclosure(false);

  const sorted = useMemo(
    () =>
      [...playlists.values()].sort(
        (a, b) =>
          (recentPlaylists[b.id] ?? 0) - (recentPlaylists[a.id] ?? 0) ||
          b.updatedAt.localeCompare(a.updatedAt),
      ),
    [playlists, recentPlaylists],
  );

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
          {!me && (
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
          {sorted.length === 0 ? (
            <Text c="dimmed">{t('playlists.none')}</Text>
          ) : wide ? (
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('playlists.colName')}</Table.Th>
                  <Table.Th>{t('playlists.colRole')}</Table.Th>
                  <Table.Th>{t('playlists.colVisibility')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sorted.map((p) => {
                  const { role, visibility } = playlistFacts(p, { t, tn });
                  return (
                    <Table.Tr
                      key={p.id}
                      className={classes.row}
                      onClick={(e) => {
                        // The title link handles its own click; the rest of the row follows it.
                        if (!(e.target as HTMLElement).closest('a')) {
                          navigate(url.playlist(p));
                        }
                      }}
                    >
                      <Table.Td>
                        <Anchor
                          component={Link}
                          to={url.playlist(p)}
                          fw={600}
                          c="inherit"
                        >
                          {p.name}
                        </Anchor>
                        <Text size="sm" c="dimmed">
                          {tn('common.songs', p.songIds.length)}
                        </Text>
                      </Table.Td>
                      <Table.Td>{role}</Table.Td>
                      <Table.Td>{visibility}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          ) : (
            <Stack gap={0} mx="-md">
              {sorted.map((p) => (
                <PlaylistRow key={p.id} playlist={p} full />
              ))}
            </Stack>
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
          <Button type="submit" loading={create.isPending}>
            {t('playlists.create')}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
