/// <reference types="node" />
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

/**
 * An in-memory database for tests, backed by Node's built-in SQLite (which,
 * like Android's, has FTS5). It covers the part of expo-sqlite's API the
 * repositories use, so their real SQL and the real migrations run unchanged.
 */
export function openTestDatabase(): SQLiteDatabase {
  const db = new DatabaseSync(':memory:');
  const statement = (sql: string) => db.prepare(sql);
  const database = {
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    getAllAsync: async (sql: string, ...params: SQLInputValue[]) => statement(sql).all(...params),
    getFirstAsync: async (sql: string, ...params: SQLInputValue[]) => statement(sql).get(...params) ?? null,
    runAsync: async (sql: string, ...params: SQLInputValue[]) => {
      const result = statement(sql).run(...params);
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
  };
  return database as unknown as SQLiteDatabase;
}
