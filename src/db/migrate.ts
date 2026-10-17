import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Numbered migrations, applied in order based on PRAGMA user_version.
 * Never edit a migration that has shipped; add a new one instead, so
 * updating the app never wipes data.
 */
const MIGRATIONS: ((db: SQLiteDatabase) => Promise<void>)[] = [
  // 1: AI chat — conversations, messages, settings and provider profiles.
  async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,           -- 'user' | 'assistant'
        content TEXT NOT NULL,        -- JSON: { text, model? }
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id, id);
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      -- API keys are not stored here; they live in expo-secure-store.
      CREATE TABLE IF NOT EXISTS providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        preset_id TEXT NOT NULL,      -- see src/ai/presets.ts
        kind TEXT NOT NULL,           -- 'openai' | 'anthropic'
        base_url TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
    `);
  },
];

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current === 0) {
    await db.execAsync("PRAGMA journal_mode = 'wal';");
  }
  for (let version = current; version < MIGRATIONS.length; version++) {
    await MIGRATIONS[version](db);
    await db.execAsync(`PRAGMA user_version = ${version + 1}`);
  }
}
