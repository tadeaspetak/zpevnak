import { fireEvent, screen } from '@testing-library/react';
import { renderApp } from '#tests/client/render.tsx';
import { describe, expect, it } from 'vitest';
import { SettingsButton } from '../SettingsButton.tsx';

describe('SettingsButton', () => {
  it('offers getting what’s new from the settings, on any page', async () => {
    localStorage.setItem('zpevnak.locale', 'en');
    renderApp(<SettingsButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const refresh = await screen.findByRole('button', { name: 'Get what’s new' });
    expect((refresh as HTMLButtonElement).disabled).toBe(false);
  });
});
