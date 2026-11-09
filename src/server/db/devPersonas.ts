import type { Role } from '#shared/validators/index.ts';

/**
 * Accounts the development seed creates, one per role, for trying the app and for UX walks.
 * Only ever created in a local database: the seed refuses anywhere else.
 */
export const DEV_PASSWORD = 'zpevnak-dev-password';

export const DEV_PERSONAS: {
  email: string;
  displayName: string;
  role: Role;
  verified: boolean;
}[] = [
  {
    email: 'admin@zpevnak.test',
    displayName: 'Adéla Adminová',
    role: 'admin',
    verified: true,
  },
  {
    email: 'editor@zpevnak.test',
    displayName: 'Erik Editor',
    role: 'editor',
    verified: true,
  },
  {
    email: 'user@zpevnak.test',
    displayName: 'Uršula Uživatelová',
    role: 'user',
    verified: true,
  },
  {
    email: 'new@zpevnak.test',
    displayName: 'Nový Nepotvrzený',
    role: 'user',
    verified: false,
  },
];
