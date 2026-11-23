import { cleanup, screen } from '@testing-library/react';
import { renderApp } from '#tests/client/render.tsx';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SongRecord } from '../../data/store.ts';
import { PrivateSongReach } from '../PrivateSongReach.tsx';

const song = (status: SongRecord['status'], role: SongRecord['role']) =>
  ({ id: 1, title: 'Naše', status, role }) as SongRecord;

describe('PrivateSongReach (D128)', () => {
  beforeEach(() => {
    localStorage.setItem('zpevnak.locale', 'cs');
  });

  it('tells a private song’s owner who else will read it, in Czech plural', () => {
    renderApp(<PrivateSongReach song={song('private', 'owner')} listmates={2} />);
    expect(screen.getByText(/^Uvidí ji i 2.parťáci$/)).toBeTruthy();
    cleanup();
    renderApp(<PrivateSongReach song={song('private', 'owner')} listmates={5} />);
    expect(screen.getByText(/^Uvidí ji i 5.parťáků$/)).toBeTruthy();
  });

  it('says nothing where it reaches nobody new: a public song, someone else’s, nobody else', () => {
    const quiet = [
      <PrivateSongReach key="a" song={song('verified', 'owner')} listmates={2} />,
      <PrivateSongReach key="b" song={song('private', 'viewer')} listmates={2} />,
      <PrivateSongReach key="c" song={song('private', 'owner')} listmates={0} />,
    ];
    for (const ui of quiet) {
      const { container } = renderApp(ui);
      // The providers bring their styles; the line itself is a paragraph.
      expect(container.querySelector('p')).toBeNull();
      cleanup();
    }
  });
});
