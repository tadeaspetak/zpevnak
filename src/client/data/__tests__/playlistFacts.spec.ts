import { describe, expect, it } from 'vitest';
import { groupPlaylists, playlistFacts } from '../playlistFacts.ts';
import type { PlaylistRecord } from '../store.ts';

const t = (key: string) => key;
const tn = (key: string, count: number) => `${count} ${key}`;
const playlist = (over: Partial<PlaylistRecord>) =>
  ({
    id: 1,
    name: 'P',
    songIds: [1, 2],
    role: 'owner',
    ownerName: 'Jana',
    isPublic: false,
    collaboratorCount: 0,
    updatedAt: '2026-11-10T10:00:00.000Z',
    ...over,
  }) as PlaylistRecord;

describe('playlistFacts (D112)', () => {
  it('says songs, and for one’s own the listmates only when there are some', () => {
    expect(playlistFacts(playlist({}), { t, tn } as never).line).toBe('2 common.songs');
    expect(
      playlistFacts(playlist({ collaboratorCount: 2 }), { t, tn } as never).line,
    ).toBe('2 common.songs · 2 playlists.collaborators');
  });

  it('names whose someone else’s playlist is, by name alone', () => {
    for (const role of ['collaborator', null] as const) {
      expect(playlistFacts(playlist({ role }), { t, tn } as never).line).toBe(
        '2 common.songs · Jana',
      );
    }
  });

  it('marks public apart, and leaves private unsaid', () => {
    expect(playlistFacts(playlist({ isPublic: true }), { t, tn } as never).isPublic).toBe(
      true,
    );
  });
});

describe('groupPlaylists', () => {
  it('groups by whose, the most recent first in each', () => {
    const lists = [
      playlist({ id: 1, role: 'owner' }),
      playlist({ id: 2, role: 'owner', updatedAt: '2026-11-11T10:00:00.000Z' }),
      playlist({ id: 3, role: 'collaborator' }),
      playlist({ id: 4, role: null }),
    ];
    const groups = groupPlaylists(lists, { 1: 500 });
    expect({
      mine: groups.mine.map((p) => p.id),
      shared: groups.shared.map((p) => p.id),
      others: groups.others.map((p) => p.id),
    }).toEqual({ mine: [1, 2], shared: [3], others: [4] });
  });
});
