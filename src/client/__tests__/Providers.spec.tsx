import { Modal } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { act, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Providers } from '../Providers.tsx';
import { useI18n } from '../i18n/index.tsx';

function Translated() {
  const { t } = useI18n();
  return <span>{t('playlists.undoRemove')}</span>;
}

describe('Providers', () => {
  it('renders a toast that reads the translations (it crashed outside them)', async () => {
    localStorage.setItem('zpevnak.locale', 'cs');
    render(<Providers>{null}</Providers>);
    act(() => {
      notifications.show({ message: <Translated /> });
    });
    expect(await screen.findByText('Beru zpátky')).toBeTruthy();
  });

  it('names every dialog’s close button, in the reader’s language', async () => {
    localStorage.setItem('zpevnak.locale', 'cs');
    render(
      <Providers>
        <Modal opened onClose={() => {}} title="Dialog">
          obsah
        </Modal>
      </Providers>,
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Zavřít' })).toBeTruthy();
  });

  it('shows a way out instead of a blank screen when a page crashes', () => {
    function Broken(): never {
      throw new Error('boom');
    }
    const quiet = console.error;
    console.error = () => {};
    try {
      render(
        <Providers>
          <Broken />
        </Providers>,
      );
    } finally {
      console.error = quiet;
    }
    expect(screen.getByRole('button', { name: 'Načíst znovu' })).toBeTruthy();
  });
});
