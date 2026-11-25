import { notifications } from '@mantine/notifications';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyIfQueued } from '../offline.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('notifyIfQueued (D133)', () => {
  it('says a change waits for the connection, offline only, as one message', () => {
    const show = vi.spyOn(notifications, 'show').mockReturnValue('saves-when-online');
    notifyIfQueued('waits');
    expect(show).not.toHaveBeenCalled();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    notifyIfQueued('waits');
    notifyIfQueued('waits');
    expect(show).toHaveBeenCalledWith({ id: 'saves-when-online', message: 'waits' });
  });
});
