import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { leavePlaylist, playPlaylist, songPlayed, usePlayer } from '../session.ts';

describe('the player session', () => {
  it('remembers recent songs, newest first, each once, twelve at most', () => {
    const { result } = renderHook(() => usePlayer());
    act(() => {
      for (let id = 1; id <= 14; id++) {
        songPlayed(id);
      }
      songPlayed(5);
    });
    expect(result.current.recentSongs).toEqual([5, 14, 13, 12, 11, 10, 9, 8, 7, 6, 4, 3]);
  });

  it('follows the playlist being played, and forgets it on leaving', () => {
    const { result } = renderHook(() => usePlayer());
    act(() => playPlaylist(3, 2));
    expect(result.current.session).toEqual({ playlistId: 3, position: 2 });
    expect(result.current.recentPlaylists[3]).toBeTypeOf('number');
    const before = result.current;
    act(() => playPlaylist(3, 2));
    // Nothing changed: no new state, so nothing re-renders.
    expect(result.current).toBe(before);
    act(() => leavePlaylist());
    expect(result.current.session).toBeNull();
    expect(localStorage.getItem('zpevnak.session')).toBe('null');
  });
});
