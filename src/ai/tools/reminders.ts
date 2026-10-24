import { cancelReminder, listReminders, scheduleReminder } from '@/services/reminders';

import { friendlyTime, integerInput, localDateTime, shown, stringInput, type Tool } from './tool';

const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;

/** Reads "2026-10-24 18:00" or "2026-10-24T18:00" as the phone's local time. */
function parseLocalTime(text: string): Date {
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})/);
  if (!match) throw new Error('"at" must look like 2026-10-24 18:00.');
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  // Date rolls over values that are out of range (31 Feb, 25:00), so check nothing moved.
  if (date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) {
    throw new Error(`"${text}" is not a real date and time.`);
  }
  return date;
}

export const reminderTools: Tool[] = [
  {
    name: 'set_reminder',
    description:
      'Schedules a notification on the phone that reminds the user of something. Give either "at" (a local date and time) or "in_minutes". Use the current time from your instructions to work out "at" for requests like "tomorrow at 9".',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'What to remind the user about, e.g. "Pay the electricity bill".' },
        at: { type: 'string', description: 'Local date and time as "YYYY-MM-DD HH:mm", 24-hour clock.' },
        in_minutes: { type: 'integer', description: 'Minutes from now, for requests like "in 20 minutes".' },
      },
      required: ['text'],
    },
    icon: 'reminder',
    label: (input, result) =>
      result ? `Reminder set for ${shown(result.when)}: ${shown(input.text)}` : `Setting a reminder: ${shown(input.text)}`,
    run: async (input) => {
      const text = stringInput(input, 'text', { max: 200 });
      const at = stringInput(input, 'at', { required: false, max: 40 });
      const minutes = integerInput(input, 'in_minutes', { min: 1, max: MAX_AHEAD_MS / 60_000 });
      let date: Date;
      if (at) date = parseLocalTime(at);
      else if (minutes !== undefined) date = new Date(Date.now() + minutes * 60_000);
      else throw new Error('Give either "at" or "in_minutes".');
      if (date.getTime() <= Date.now()) throw new Error(`${localDateTime(date.getTime())} has already passed.`);
      if (date.getTime() - Date.now() > MAX_AHEAD_MS) throw new Error('Reminders can be at most a year ahead.');

      const { id, exact } = await scheduleReminder(text, date);
      return {
        scheduled: true,
        id,
        at: localDateTime(date.getTime()),
        when: friendlyTime(date.getTime()),
        ...(!exact && {
          note: 'Exact alarms are off for Nova, so Android may deliver this a few minutes late. The user can turn on "Exact reminder times" in Nova Settings.',
        }),
      };
    },
  },
  {
    name: 'list_reminders',
    description: 'Lists the reminders that are scheduled and have not fired yet, soonest first, with their ids.',
    inputSchema: { type: 'object', properties: {} },
    icon: 'reminder',
    label: (_input, result) =>
      result ? `Checked reminders · ${result.count === 0 ? 'none scheduled' : `${result.count} scheduled`}` : 'Checking reminders',
    run: async () => {
      const reminders = await listReminders();
      return {
        count: reminders.length,
        reminders: reminders.map((r) => ({ id: r.id, text: r.text, at: localDateTime(r.at) })),
      };
    },
  },
  {
    name: 'cancel_reminder',
    description: 'Deletes a scheduled reminder by its id from list_reminders or set_reminder. The user is asked to confirm first.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The id of the reminder.' },
      },
      required: ['id'],
    },
    icon: 'reminder',
    label: (_input, result) => (result ? `Deleted reminder: ${shown(result.text)}` : 'Deleting a reminder'),
    confirm: async (input) => {
      const id = stringInput(input, 'id', { max: 200 });
      const reminder = (await listReminders()).find((r) => r.id === id);
      // A missing reminder needs no confirmation; run() reports the error.
      return reminder ? { title: 'Delete reminder?', message: `“${reminder.text}” on ${friendlyTime(reminder.at)}`, action: 'Delete' } : null;
    },
    run: async (input) => {
      const id = stringInput(input, 'id', { max: 200 });
      const reminder = (await listReminders()).find((r) => r.id === id);
      if (!reminder) throw new Error('There is no scheduled reminder with that id. It may have fired already.');
      await cancelReminder(id);
      return { cancelled: true, text: reminder.text };
    },
  },
];
