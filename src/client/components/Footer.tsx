import { Anchor, Group } from '@mantine/core';
import { IconBrandGithub } from '@tabler/icons-react';
import { mailtoAuthor, REPOSITORY } from '../contact.ts';
import { useI18n } from '../i18n/index.tsx';
import classes from './Footer.module.css';
import { OwlIcon } from './OwlIcon.tsx';

/** Where the app comes from and how to reach its author. Every page but a song's. */
export function Footer() {
  const { t } = useI18n();
  return (
    <footer className={classes.footer}>
      <Group gap="lg" justify="center">
        <Anchor href={REPOSITORY} target="_blank" rel="noreferrer" size="sm" c="dimmed">
          <Group gap={6} wrap="nowrap">
            <IconBrandGithub size={16} aria-hidden />
            {t('about.source')}
          </Group>
        </Anchor>
        <Anchor href={mailtoAuthor(t('app.name'))} size="sm" c="dimmed">
          <Group gap={6} wrap="nowrap">
            <OwlIcon size={16} />
            {t('about.contact')}
          </Group>
        </Anchor>
      </Group>
    </footer>
  );
}
