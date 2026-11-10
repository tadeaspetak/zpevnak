import { describe, expect, it } from 'vitest';
import { canChangeSong, isEditor } from '../songs.ts';

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
      expect(canChangeSong(user(1), { status, createdBy: 1 })).toBe(true);
    }
    expect(canChangeSong(user(1), { status: 'verified', createdBy: 1 })).toBe(false);
  });

  it('lets editors and admins change any song, an approved one too', () => {
    for (const role of ['editor', 'admin'] as const) {
      expect(canChangeSong(user(2, role), { status: 'verified', createdBy: 1 })).toBe(
        true,
      );
    }
  });

  it("refuses someone else's song, a stranger and an unconfirmed email", () => {
    expect(canChangeSong(user(2), { status: 'pending', createdBy: 1 })).toBe(false);
    expect(canChangeSong(null, { status: 'pending', createdBy: 1 })).toBe(false);
    expect(
      canChangeSong(user(1, 'user', false), { status: 'pending', createdBy: 1 }),
    ).toBe(false);
    expect(
      canChangeSong(user(2, 'editor', false), { status: 'pending', createdBy: 1 }),
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
