import type { SQLiteDatabase } from 'expo-sqlite';

export type NoteAuthor = 'user' | 'ai';

export interface Note {
  id: number;
  title: string;
  body: string;
  /** Private notes are never sent to the AI. */
  isPrivate: boolean;
  createdBy: NoteAuthor;
  createdAt: number;
  updatedAt: number;
}

/**
 * Whether private notes are visible to the caller. Every query takes it, so
 * the privacy rule lives here and not in a prompt (spec §7): screens pass
 * true, AI tools always pass false.
 */
export interface NoteAccess {
  includePrivate: boolean;
}

export type NoteFilter = 'all' | 'public' | 'private';

interface NoteRow {
  id: number;
  title: string;
  body: string;
  is_private: number;
  created_by: NoteAuthor;
  created_at: number;
  updated_at: number;
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    isPrivate: row.is_private === 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The WHERE conditions (on table alias n) for what the caller may see and asked to see. */
function scope({ includePrivate }: NoteAccess, filter: NoteFilter = 'all') {
  const conditions = ['1 = 1'];
  if (!includePrivate || filter === 'public') conditions.push('n.is_private = 0');
  if (filter === 'private') conditions.push('n.is_private = 1');
  return conditions.join(' AND ');
}

export async function listNotes(
  db: SQLiteDatabase,
  access: NoteAccess,
  { filter = 'all', limit = 500 }: { filter?: NoteFilter; limit?: number } = {}
): Promise<Note[]> {
  const rows = await db.getAllAsync<NoteRow>(
    `SELECT n.* FROM notes n WHERE ${scope(access, filter)} ORDER BY n.updated_at DESC LIMIT ?`,
    limit
  );
  return rows.map(toNote);
}

const hasIndex = new WeakMap<SQLiteDatabase, Promise<boolean>>();

/** Whether this database has the full-text index; see migration 3. */
function hasFullTextIndex(db: SQLiteDatabase) {
  let known = hasIndex.get(db);
  if (!known) {
    known = db
      .getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notes_fts'")
      .then((row) => !!row);
    hasIndex.set(db, known);
  }
  return known;
}

/**
 * Notes containing every word of `query` (word starts count, so "elec"
 * finds "electricity"), best matches first.
 */
export async function searchNotes(
  db: SQLiteDatabase,
  query: string,
  access: NoteAccess,
  { filter = 'all', limit = 50 }: { filter?: NoteFilter; limit?: number } = {}
): Promise<Note[]> {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 8);
  if (!words.length) return listNotes(db, access, { filter, limit });

  if (await hasFullTextIndex(db)) {
    // Each word as a quoted prefix term, so punctuation in it can't break the query syntax.
    const match = words.map((word) => `"${word.replace(/"/g, '""')}"*`).join(' ');
    const rows = await db.getAllAsync<NoteRow>(
      `SELECT n.* FROM notes_fts JOIN notes n ON n.id = notes_fts.rowid
       WHERE notes_fts MATCH ? AND ${scope(access, filter)}
       ORDER BY bm25(notes_fts) LIMIT ?`,
      match,
      limit
    );
    return rows.map(toNote);
  }

  const conditions = words.map(() => "(n.title || ' ' || n.body) LIKE ? ESCAPE '\\'").join(' AND ');
  const rows = await db.getAllAsync<NoteRow>(
    `SELECT n.* FROM notes n WHERE ${conditions} AND ${scope(access, filter)} ORDER BY n.updated_at DESC LIMIT ?`,
    ...words.map((word) => `%${word.replace(/[\\%_]/g, '\\$&')}%`),
    limit
  );
  return rows.map(toNote);
}

/** How many private notes exist, for "2 private notes hidden" while they're locked. */
export async function countPrivateNotes(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM notes WHERE is_private = 1');
  return row?.count ?? 0;
}

export async function getNote(db: SQLiteDatabase, id: number, access: NoteAccess): Promise<Note | null> {
  const row = await db.getFirstAsync<NoteRow>(`SELECT n.* FROM notes n WHERE n.id = ? AND ${scope(access)}`, id);
  return row ? toNote(row) : null;
}

export async function createNote(
  db: SQLiteDatabase,
  { title, body, isPrivate = false, createdBy = 'user' }: { title: string; body: string; isPrivate?: boolean; createdBy?: NoteAuthor }
): Promise<Note> {
  const now = Date.now();
  const result = await db.runAsync(
    'INSERT INTO notes (title, body, is_private, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    title,
    body,
    isPrivate ? 1 : 0,
    createdBy,
    now,
    now
  );
  return { id: result.lastInsertRowId, title, body, isPrivate, createdBy, createdAt: now, updatedAt: now };
}

/** Changes a note the caller can see. Resolves with the updated note, or null if there is none. */
export async function updateNote(
  db: SQLiteDatabase,
  id: number,
  changes: Partial<Pick<Note, 'title' | 'body' | 'isPrivate'>>,
  access: NoteAccess
): Promise<Note | null> {
  const current = await getNote(db, id, access);
  if (!current) return null;
  const next = { ...current, ...changes, updatedAt: Date.now() };
  await db.runAsync(
    'UPDATE notes SET title = ?, body = ?, is_private = ?, updated_at = ? WHERE id = ?',
    next.title,
    next.body,
    next.isPrivate ? 1 : 0,
    next.updatedAt,
    id
  );
  return next;
}

/** Deletes a note the caller can see. Resolves false if there was none. */
export async function deleteNote(db: SQLiteDatabase, id: number, access: NoteAccess): Promise<boolean> {
  // A subquery rather than DELETE ... AS n, which older SQLite builds reject.
  const result = await db.runAsync(
    `DELETE FROM notes WHERE id IN (SELECT n.id FROM notes n WHERE n.id = ? AND ${scope(access)})`,
    id
  );
  return result.changes > 0;
}
