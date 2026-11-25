import { notifications } from '@mantine/notifications';

/**
 * Says a change made offline waits for the connection: requests that write wait instead of
 * failing (`onlineManager`, Providers), so without this it would go quietly, and the reader
 * wouldn't know it hasn't reached anyone yet. One message however many changes wait. Call it
 * with each change that writes; it says nothing online. `message`: `common.savesWhenOnline`.
 */
export function notifyIfQueued(message: string) {
  if (!navigator.onLine) {
    notifications.show({ id: 'saves-when-online', message });
  }
}
