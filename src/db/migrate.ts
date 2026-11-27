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
  // 2: Long-term memory — short facts about the user that the AI saves with its remember tool.
  async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  },
  // 3: Notes (spec §7), with a full-text index kept in sync by triggers.
  async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        is_private INTEGER NOT NULL DEFAULT 0,   -- 1 = hidden from the AI
        created_by TEXT NOT NULL DEFAULT 'user', -- 'user' | 'ai'
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS notes_updated ON notes(updated_at);
    `);
    // The web preview's SQLite has no FTS5, so the index is skipped there and
    // notesRepo falls back to LIKE. Android's build always has it.
    try {
      await db.execAsync(
        "CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(title, body, content='notes', content_rowid='id');"
      );
    } catch {
      return;
    }
    await db.execAsync(`
      CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
      END;
      CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
      END;
      CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE OF title, body ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
        INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
      END;
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
