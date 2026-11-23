import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderApp } from '#tests/client/render.tsx';
import type { SongRecord } from '../../data/store.ts';
import { SongStatusBanner } from '../SongStatusBanner.tsx';

const pending = {
  id: 7,
  title: 'Píseň',
  status: 'pending',
  rejection: null,
} as SongRecord;

describe('SongStatusBanner: from an unchecked song to its review (D121)', () => {
  beforeEach(() => {
    localStorage.setItem('zpevnak.locale', 'cs');
  });

  it('leads whoever may review the song straight to its review', () => {
    renderApp(<SongStatusBanner song={pending} reviewTo="/queue/7" />);
    expect(screen.getByRole('link', { name: 'Zkontrolovat' }).getAttribute('href')).toBe(
      '/queue/7',
    );
  });

  it('only says it is unchecked to everyone else', () => {
    renderApp(<SongStatusBanner song={pending} />);
    expect(screen.getByText('Tuhle písničku zatím nikdo neschválil.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Zkontrolovat' })).toBeNull();
  });
});
