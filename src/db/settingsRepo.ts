import type { SQLiteDatabase } from 'expo-sqlite';

export type SettingKey =
  | 'active_provider_id'
  /** JSON list of { providerId, model }, most recent first. */
  | 'recent_models'
  /** Custom instructions: what the user wants Nova to know about them, and how to reply. */
  | 'about_user'
  | 'reply_style';

export async function getSetting(db: SQLiteDatabase, key: SettingKey): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: SettingKey, value: string | null) {
  if (value === null) {
    await db.runAsync('DELETE FROM settings WHERE key = ?', key);
  } else {
    await db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value
    );
  }
}
