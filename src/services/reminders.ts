import { requireOptionalNativeModule } from 'expo';
import type * as NotificationsModule from 'expo-notifications';

// Reminders are local notifications scheduled with expo-notifications. Nothing
// is stored in the database: the system's schedule is the list of reminders,
// and each one carries its text and time in `data`.

const CHANNEL_ID = 'reminders';
const KIND = 'nova-reminder';

export interface Reminder {
  id: string;
  text: string;
  /** When it fires, in Unix milliseconds. */
  at: number;
}

let loading: Promise<typeof NotificationsModule> | null = null;

/**
 * expo-notifications' native code is only in app builds made after it was
 * added, not in an older development build or Expo Go. Importing it without
 * that code throws and logs an error, so check for two of its modules first.
 */
function nativeCodeAvailable() {
  return !!requireOptionalNativeModule('ExpoPushTokenManager') && !!requireOptionalNativeModule('ExpoNotificationScheduler');
}

/**
 * Loads expo-notifications on first use, so an app build without its native
 * module only loses reminders instead of failing to start.
 */
function notifications() {
  if (!nativeCodeAvailable()) {
    return Promise.reject(
      new Error('Reminders need a newer build of Nova than the one installed on this phone. Make and install a new development build.')
    );
  }
  loading ??= (async () => {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
    return Notifications;
  })().catch((error) => {
    loading = null;
    throw new Error(`Reminders are not available in this build of Nova. ${error instanceof Error ? error.message : ''}`.trim());
  });
  return loading;
}

/** Call at startup so reminders that fire while Nova is open still show a banner. */
export function initReminders() {
  notifications().catch(() => {});
}

/** Schedules a reminder. `exact` is false when Android may deliver it a few minutes late. */
export async function scheduleReminder(text: string, at: Date): Promise<{ id: string; exact: boolean }> {
  const Notifications = await notifications();
  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted) ({ granted } = await Notifications.requestPermissionsAsync());
  if (!granted) {
    throw new Error('Notifications are turned off for Nova. Allow them in Android Settings → Apps → Nova → Notifications.');
  }
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: 'Reminder', body: text, data: { kind: KIND, text, at: at.getTime() } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
  });
  return { id, exact: (await Notifications.getExactAlarmPermissionsAsync()).granted };
}

export async function listReminders(): Promise<Reminder[]> {
  const Notifications = await notifications();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled
    .filter((request) => request.content.data?.kind === KIND)
    .map((request) => ({
      id: request.identifier,
      text: String(request.content.data?.text ?? request.content.body ?? ''),
      at: Number(request.content.data?.at),
    }))
    .sort((a, b) => a.at - b.at);
}

export async function cancelReminder(id: string) {
  const Notifications = await notifications();
  await Notifications.cancelScheduledNotificationAsync(id);
}

/** Whether Android lets Nova fire reminders at the exact minute (the "Alarms & reminders" permission). */
export async function exactRemindersAllowed(): Promise<boolean> {
  const Notifications = await notifications();
  return (await Notifications.getExactAlarmPermissionsAsync()).granted;
}

/** Opens the system screen where the user can allow exact reminders. Resolves with the new state. */
export async function allowExactReminders(): Promise<boolean> {
  const Notifications = await notifications();
  return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
}
