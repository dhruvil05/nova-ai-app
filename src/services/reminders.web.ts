// The web dev preview cannot schedule notifications, so the reminder tools
// report that instead of failing in a confusing way.
import type { Reminder } from './reminders';

export type { Reminder };

const UNAVAILABLE = 'Reminders work on the phone, not in the web preview.';

export function initReminders() {}

export async function scheduleReminder(_text: string, _at: Date): Promise<{ id: string; exact: boolean }> {
  throw new Error(UNAVAILABLE);
}

export async function listReminders(): Promise<Reminder[]> {
  throw new Error(UNAVAILABLE);
}

export async function cancelReminder(_id: string) {
  throw new Error(UNAVAILABLE);
}

export async function exactRemindersAllowed() {
  return true;
}

export async function allowExactReminders() {
  return true;
}
