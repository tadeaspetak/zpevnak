import { Group, Select, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Navigate } from 'react-router';
import { ROLES, type Role } from '#shared/validators/index.ts';
import { ErrorText } from '../components/ErrorText.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';

export function AdminUsersPage() {
  const { t } = useI18n();
  const { me, isAdmin, known } = useMe();
  const utils = trpc.useUtils();
  const users = trpc.users.list.useQuery(undefined, { enabled: isAdmin });
  const setRole = trpc.users.setRole.useMutation({
    onSuccess: () => void utils.users.list.invalidate(),
  });

  if (known && !isAdmin) {
    return <Navigate to={url.home()} replace />;
  }

  return (
    <>
      <PageHeader
        title={t('users.title')}
        backTo={url.account()}
        backLabel={t('nav.backTo', { name: t('account.title') })}
      />
      <Page>
        <ErrorText error={users.error ?? setRole.error} />
        <Stack gap="xs">
          {users.data?.map((user) => (
            <Group key={user.id} justify="space-between" wrap="nowrap" py={4}>
              <div style={{ minWidth: 0 }}>
                <Text fw={600} truncate>
                  {user.displayName}
                  {user.id === me?.id && ` (${t('users.you')})`}
                </Text>
                <Text size="sm" c="dimmed" truncate>
                  {user.email}
                  {!user.emailVerified && ` · ${t('users.unverified')}`}
                </Text>
              </div>
              <Select
                size="sm"
                w={130}
                aria-label={t('users.role')}
                value={user.role}
                disabled={user.id === me?.id}
                allowDeselect={false}
                data={ROLES.map((r) => ({ value: r, label: t(`account.role.${r}`) }))}
                onChange={(role) =>
                  role &&
                  setRole.mutate(
                    { userId: user.id, role: role as Role },
                    {
                      // Named from the row itself: the person whose role it is.
                      onSuccess: () =>
                        notifications.show({
                          message: t('users.roleChanged', {
                            name: user.displayName,
                            role: t(`account.role.${role as Role}`),
                          }),
                        }),
                    },
                  )
                }
              />
            </Group>
          ))}
        </Stack>
      </Page>
    </>
  );
}
