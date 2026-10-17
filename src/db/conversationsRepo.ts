import type { SQLiteDatabase } from 'expo-sqlite';

export type Role = 'user' | 'assistant';

export interface Conversation {
  id: number;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: number;
  conversationId: number;
  role: Role;
  text: string;
  /** Model that wrote an assistant message. */
  model?: string;
  createdAt: number;
}

interface ConversationRow {
  id: number;
  title: string | null;
  created_at: number;
  updated_at: number;
}

interface MessageRow {
  id: number;
  conversation_id: number;
  role: Role;
  content: string;
  created_at: number;
}

const TITLE_LENGTH = 48;

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title || 'New chat',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMessage(row: MessageRow): Message {
  let content: { text?: string; model?: string } = {};
  try {
    content = JSON.parse(row.content);
  } catch {
    content = { text: row.content };
  }
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    text: content.text ?? '',
    model: content.model,
    createdAt: row.created_at,
  };
}

export function titleFrom(text: string) {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > TITLE_LENGTH ? `${oneLine.slice(0, TITLE_LENGTH - 1)}…` : oneLine;
}

export async function listConversations(db: SQLiteDatabase): Promise<Conversation[]> {
  const rows = await db.getAllAsync<ConversationRow>(
    'SELECT * FROM conversations ORDER BY updated_at DESC'
  );
  return rows.map(toConversation);
}

export async function createConversation(db: SQLiteDatabase, title: string): Promise<number> {
  const now = Date.now();
  const result = await db.runAsync(
    'INSERT INTO conversations (title, created_at, updated_at) VALUES (?, ?, ?)',
    title,
    now,
    now
  );
  return result.lastInsertRowId;
}

export async function deleteConversation(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM messages WHERE conversation_id = ?', id);
  await db.runAsync('DELETE FROM conversations WHERE id = ?', id);
}

export async function deleteAllConversations(db: SQLiteDatabase) {
  await db.execAsync('DELETE FROM messages; DELETE FROM conversations;');
}

export async function listMessages(db: SQLiteDatabase, conversationId: number): Promise<Message[]> {
  const rows = await db.getAllAsync<MessageRow>(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC',
    conversationId
  );
  return rows.map(toMessage);
}

export async function addMessage(
  db: SQLiteDatabase,
  conversationId: number,
  role: Role,
  text: string,
  model?: string
): Promise<Message> {
  const now = Date.now();
  const content = JSON.stringify(model ? { text, model } : { text });
  const result = await db.runAsync(
    'INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)',
    conversationId,
    role,
    content,
    now
  );
  await db.runAsync('UPDATE conversations SET updated_at = ? WHERE id = ?', now, conversationId);
  return { id: result.lastInsertRowId, conversationId, role, text, model, createdAt: now };
}
