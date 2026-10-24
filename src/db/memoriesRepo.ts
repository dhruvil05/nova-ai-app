import type { SQLiteDatabase } from 'expo-sqlite';

/** A short fact about the user that Nova keeps between chats, such as "Prefers replies in Gujarati". */
export interface Memory {
  id: number;
  text: string;
  createdAt: number;
}

interface MemoryRow {
  id: number;
  text: string;
  created_at: number;
}

function toMemory(row: MemoryRow): Memory {
  return { id: row.id, text: row.text, createdAt: row.created_at };
}

export async function listMemories(db: SQLiteDatabase): Promise<Memory[]> {
  const rows = await db.getAllAsync<MemoryRow>('SELECT * FROM memories ORDER BY id ASC');
  return rows.map(toMemory);
}

export async function getMemory(db: SQLiteDatabase, id: number): Promise<Memory | null> {
  const row = await db.getFirstAsync<MemoryRow>('SELECT * FROM memories WHERE id = ?', id);
  return row ? toMemory(row) : null;
}

export async function addMemory(db: SQLiteDatabase, text: string): Promise<Memory> {
  const now = Date.now();
  const result = await db.runAsync('INSERT INTO memories (text, created_at) VALUES (?, ?)', text, now);
  return { id: result.lastInsertRowId, text, createdAt: now };
}

export async function deleteMemory(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM memories WHERE id = ?', id);
}
