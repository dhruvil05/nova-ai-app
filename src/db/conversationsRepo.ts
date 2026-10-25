import type { SQLiteDatabase } from 'expo-sqlite';

import type { ToolCall } from '@/ai/llm';

export type Role = 'user' | 'assistant' | 'tool';

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
  /** What the user or assistant wrote. Empty for tool results. */
  text: string;
  /** Model that wrote an assistant message. */
  model?: string;
  /** A reasoning model's thinking before it answered. */
  reasoning?: string;
  /** Tools the assistant asked to run. Their results follow as 'tool' messages. */
  toolCalls?: ToolCall[];
  /** The reply hit the length limit and stops mid-answer. */
  cutOff?: boolean;
  /** The model does not support tools, so it answered without them. */
  toolsUnsupported?: boolean;
  /** For a tool result: the call it answers, the tool's name, and what the tool returned. */
  toolCallId?: string;
  toolName?: string;
  result?: Record<string, unknown>;
  createdAt: number;
}

export type MessageInput = Omit<Message, 'id' | 'conversationId' | 'createdAt'>;

/** A past message that matched a search. */
export interface MessageMatch {
  conversationId: number;
  title: string;
  role: 'user' | 'assistant';
  text: string;
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
  let content: Partial<MessageInput> = {};
  try {
    content = JSON.parse(row.content);
  } catch {
    content = { text: row.content };
  }
  return {
    ...content,
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    text: content.text ?? '',
    createdAt: row.created_at,
  };
}

/**
 * The results of the tool calls in messages[index], by call id. They are the
 * tool messages right after it, so ids only need to be unique within one reply.
 */
export function toolResultsAfter(messages: Message[], index: number): Map<string, Message> {
  const results = new Map<string, Message>();
  for (let i = index + 1; i < messages.length && messages[i].role === 'tool'; i++) {
    const id = messages[i].toolCallId;
    if (id) results.set(id, messages[i]);
  }
  return results;
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

export async function renameConversation(db: SQLiteDatabase, id: number, title: string) {
  await db.runAsync('UPDATE conversations SET title = ? WHERE id = ?', title, id);
}

/** A chat found by a search, with the newest message that matched (if the title alone did not). */
export interface ConversationMatch extends Conversation {
  match?: string;
}

/** Chats whose title or messages contain `query`, most recently active first. */
export async function searchConversations(db: SQLiteDatabase, query: string): Promise<ConversationMatch[]> {
  const pattern = `%${query.trim().replace(/[\\%_]/g, '\\$&')}%`;
  const rows = await db.getAllAsync<ConversationRow & { matched_text: string | null }>(
    `SELECT * FROM (
       SELECT c.*, (
         SELECT json_extract(m.content, '$.text') FROM messages m
         WHERE m.conversation_id = c.id AND m.role IN ('user', 'assistant')
           AND json_extract(m.content, '$.text') LIKE ? ESCAPE '\\'
         ORDER BY m.id DESC LIMIT 1
       ) AS matched_text
       FROM conversations c
     )
     WHERE title LIKE ? ESCAPE '\\' OR matched_text IS NOT NULL
     ORDER BY updated_at DESC`,
    pattern,
    pattern
  );
  return rows.map((row) => ({ ...toConversation(row), match: row.matched_text ?? undefined }));
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

/** Deletes a message and everything after it, to regenerate a reply or edit a message. */
export async function deleteMessagesFrom(db: SQLiteDatabase, conversationId: number, fromId: number) {
  await db.runAsync('DELETE FROM messages WHERE conversation_id = ? AND id >= ?', conversationId, fromId);
}

export async function addMessage(db: SQLiteDatabase, conversationId: number, input: MessageInput): Promise<Message> {
  const now = Date.now();
  // Everything but the role goes into the JSON content column; unset fields are left out.
  const { role, ...content } = input;
  const result = await db.runAsync(
    'INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)',
    conversationId,
    role,
    JSON.stringify(content),
    now
  );
  await db.runAsync('UPDATE conversations SET updated_at = ? WHERE id = ?', now, conversationId);
  return { ...input, id: result.lastInsertRowId, conversationId, createdAt: now };
}

/** Finds user and assistant messages that contain every word of `query`, newest first. */
export async function searchMessages(
  db: SQLiteDatabase,
  query: string,
  { excludeConversationId, limit }: { excludeConversationId?: number; limit: number }
): Promise<MessageMatch[]> {
  const words = query.split(/\s+/).filter(Boolean).slice(0, 8);
  if (!words.length) return [];
  const conditions = words.map(() => "json_extract(m.content, '$.text') LIKE ? ESCAPE '\\'").join(' AND ');
  const patterns = words.map((word) => `%${word.replace(/[\\%_]/g, '\\$&')}%`);
  const rows = await db.getAllAsync<{ conversation_id: number; title: string | null; role: 'user' | 'assistant'; text: string; created_at: number }>(
    `SELECT m.conversation_id, c.title, m.role, json_extract(m.content, '$.text') AS text, m.created_at
     FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE m.role IN ('user', 'assistant') AND m.conversation_id IS NOT ? AND ${conditions}
     ORDER BY m.id DESC LIMIT ?`,
    excludeConversationId ?? null,
    ...patterns,
    limit
  );
  return rows.map((row) => ({
    conversationId: row.conversation_id,
    title: row.title || 'New chat',
    role: row.role,
    text: row.text,
    createdAt: row.created_at,
  }));
}
