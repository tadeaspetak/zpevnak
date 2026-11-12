import { Group, NativeSelect, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ROLES, type Role } from '#shared/validators/index.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { ErrorText } from './ErrorText.tsx';
import { PageLoader } from './PageLoader.tsx';

/** Everyone with an account, and their role: the admin's tab on the account page (D113). */
export function UsersList() {
  const { t } = useI18n();
  const { me } = useMe();
  const utils = trpc.useUtils();
  const users = trpc.users.list.useQuery();
  const setRole = trpc.users.setRole.useMutation({
    onSuccess: () => void utils.users.list.invalidate(),
  });
  return (
    <>
      <ErrorText error={users.error ?? setRole.error} />
      {users.isLoading && <PageLoader />}
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
            {/* The device's own picker: on a phone, a list to tap, not an input with a caret. */}
            <NativeSelect
              size="sm"
              w={130}
              aria-label={t('users.role')}
              value={user.role}
              disabled={user.id === me?.id}
              data={ROLES.map((r) => ({ value: r, label: t(`account.role.${r}`) }))}
              onChange={(e) => {
                const role = e.currentTarget.value as Role;
                setRole.mutate(
                  { userId: user.id, role },
                  {
                    // Named from the row itself: the person whose role it is.
                    onSuccess: () =>
                      notifications.show({
                        message: t('users.roleChanged', {
                          name: user.displayName,
                          role: t(`account.role.${role}`),
                        }),
                      }),
                  },
                );
              }}
            />
          </Group>
        ))}
      </Stack>
    </>
  );
}
