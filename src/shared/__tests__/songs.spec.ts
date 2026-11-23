import { describe, expect, it } from 'vitest';
import { canChangeSong, canDeleteSong, inSearch, isEditor } from '../songs.ts';

const user = (
  id: number,
  role: 'user' | 'editor' | 'admin' = 'user',
  emailVerified = true,
) => ({
  id,
  role,
  emailVerified,
});

describe('canChangeSong (D78, D81)', () => {
  it('lets an author change their own song until it is approved', () => {
    for (const status of ['pending', 'rejected'] as const) {
      expect(canChangeSong(user(1), { status, createdBy: 1, role: null })).toBe(true);
    }
    expect(canChangeSong(user(1), { status: 'verified', createdBy: 1, role: null })).toBe(
      false,
    );
  });

  it('lets editors and admins change any song, an approved one too', () => {
    for (const role of ['editor', 'admin'] as const) {
      expect(
        canChangeSong(user(2, role), { status: 'verified', createdBy: 1, role: null }),
      ).toBe(true);
    }
  });

  it("refuses someone else's song, a stranger and an unconfirmed email", () => {
    expect(canChangeSong(user(2), { status: 'pending', createdBy: 1, role: null })).toBe(
      false,
    );
    expect(canChangeSong(null, { status: 'pending', createdBy: 1, role: null })).toBe(
      false,
    );
    expect(
      canChangeSong(user(1, 'user', false), {
        status: 'pending',
        createdBy: 1,
        role: null,
      }),
    ).toBe(false);
    expect(
      canChangeSong(user(2, 'editor', false), {
        status: 'pending',
        createdBy: 1,
        role: null,
      }),
    ).toBe(false);
  });

  it('knows editors', () => {
    expect([null, user(1), user(1, 'editor'), user(1, 'admin')].map(isEditor)).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });
});

describe('a private song (D127)', () => {
  const song = (role: 'owner' | 'collaborator' | 'viewer' | null) => ({
    status: 'private' as const,
    createdBy: 1,
    role,
  });

  it('is changed by its owner and its collaborators, deleted by its owner alone', () => {
    expect(canChangeSong(user(1), song('owner'))).toBe(true);
    expect(canChangeSong(user(2), song('collaborator'))).toBe(true);
    expect(canDeleteSong(user(1), song('owner'))).toBe(true);
    expect(canDeleteSong(user(2), song('collaborator'))).toBe(false);
  });

  it('not by a reader, and not by the songbook’s editors', () => {
    expect(canChangeSong(user(3), song('viewer'))).toBe(false);
    for (const role of ['editor', 'admin'] as const) {
      expect(canChangeSong(user(4, role), song(null))).toBe(false);
      expect(canDeleteSong(user(4, role), song(null))).toBe(false);
    }
  });

  it('needs a confirmed email, its owner’s too', () => {
    expect(canChangeSong(user(1, 'user', false), song('owner'))).toBe(false);
    expect(canDeleteSong(user(1, 'user', false), song('owner'))).toBe(false);
  });

  it('is found by whoever has it', () => {
    expect(inSearch(song('viewer'), 3)).toBe(true);
  });
});
