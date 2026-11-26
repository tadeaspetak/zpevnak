import { describe, expect, it, vi } from 'vitest';
import { reportOffer } from '../reportOffer.ts';

const reader = {
  isPrivate: false,
  signedIn: true,
  start: vi.fn(),
  path: '/playlist/1-vrsek/2',
  unconfirmed: vi.fn(),
};

describe('reportOffer (D143)', () => {
  it('opens the report for a confirmed reader, an editor as well as a player', () => {
    expect(reportOffer(reader)).toEqual({ onClick: reader.start });
  });

  it('leads one signed out through signing in, back to the report where they were', () => {
    expect(reportOffer({ ...reader, signedIn: false, start: undefined })).toEqual({
      to: `/login?next=${encodeURIComponent('/playlist/1-vrsek/2?report=1')}`,
    });
  });

  it('tells one not yet confirmed to confirm first', () => {
    expect(reportOffer({ ...reader, start: undefined })).toEqual({
      onClick: reader.unconfirmed,
    });
  });

  it('offers nothing on a private song, which no editor reviews', () => {
    expect(reportOffer({ ...reader, isPrivate: true })).toBeNull();
    expect(reportOffer({ ...reader, isPrivate: true, signedIn: false })).toBeNull();
  });
});
