import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { SQLiteDatabase } from 'expo-sqlite';

import { executeTool, type ConfirmPrompt } from '@/ai/tools';
import { migrate } from '@/db/migrate';
import { createNote, getNote, type Note } from '@/db/notesRepo';

import { openTestDatabase } from './sqlite';

// Spec §11: "a unit test proving AI tools never return [private notes]".
// These run the real note tools against the real migrations and SQL.

const SECRET = 'PIN 4821';

let db: SQLiteDatabase;
let shopping: Note;
let bank: Note;

beforeEach(async () => {
  db = openTestDatabase();
  await migrate(db);
  shopping = await createNote(db, { title: 'Shopping list', body: 'Milk, paneer, bank statement envelope' });
  bank = await createNote(db, { title: 'Bank details', body: `Savings account, ${SECRET}`, isPrivate: true });
});

/** Runs a tool as the agent would. `ask` answers its confirmation, if it asks. */
async function run(name: string, input: Record<string, unknown>, ask: (prompt: ConfirmPrompt) => Promise<boolean> = async () => true) {
  return executeTool({ id: 'call_1', name, input }, { db, conversationId: 1 }, ask);
}

const leaks = (result: unknown) => /4821|Bank details|Savings account/.test(JSON.stringify(result));

test('the migration builds the full-text index', async () => {
  const index = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE name = 'notes_fts'");
  expect(index?.name).toBe('notes_fts');
});

describe('AI note tools never reach private notes', () => {
  test('search_notes skips private notes, even when every word matches', async () => {
    for (const query of ['savings', 'PIN', '4821', 'bank']) {
      const result = await run('search_notes', { query });
      expect(leaks(result)).toBe(false);
    }
    // "bank" is in both; only the public note may come back.
    const bankSearch = await run('search_notes', { query: 'bank' });
    expect(bankSearch.count).toBe(1);
    expect(JSON.stringify(bankSearch)).toContain('Shopping list');
  });

  test('search_notes with no query lists only public notes', async () => {
    const result = await run('search_notes', {});
    expect(result.count).toBe(1);
    expect(leaks(result)).toBe(false);
  });

  test('get_note answers a private id exactly like a missing one', async () => {
    const privateResult = await run('get_note', { id: bank.id });
    const missingResult = await run('get_note', { id: 999 });
    expect(privateResult.error).toBe(`There is no note with id ${bank.id}. Use search_notes to find its id.`);
    expect(missingResult.error).toBe('There is no note with id 999. Use search_notes to find its id.');
    expect(leaks(privateResult)).toBe(false);
  });

  test('update_note cannot change a private note', async () => {
    const result = await run('update_note', { id: bank.id, append: 'hacked' });
    expect(result.error).toBeDefined();
    expect(await getNote(db, bank.id, { includePrivate: true })).toMatchObject({ body: `Savings account, ${SECRET}` });
  });

  test('delete_note cannot delete a private note, and never asks about it', async () => {
    const ask = jest.fn(async (_prompt: ConfirmPrompt) => true);
    const result = await run('delete_note', { id: bank.id }, ask);
    expect(result.error).toBeDefined();
    expect(ask).not.toHaveBeenCalled();
    expect(await getNote(db, bank.id, { includePrivate: true })).not.toBeNull();
  });
});

describe('AI note tools on public notes', () => {
  test('create_note saves a public note marked as written by the AI', async () => {
    const result = await run('create_note', { title: 'Electricity bill', body: 'Due on the 15th' });
    const note = await getNote(db, Number(result.id), { includePrivate: false });
    expect(note).toMatchObject({ title: 'Electricity bill', isPrivate: false, createdBy: 'ai' });
  });

  test('search_notes finds word starts', async () => {
    const result = await run('search_notes', { query: 'pan' });
    expect(result.count).toBe(1);
  });

  test('update_note appends on a new line', async () => {
    await run('update_note', { id: shopping.id, append: 'Tea' });
    expect((await getNote(db, shopping.id, { includePrivate: false }))?.body).toBe('Milk, paneer, bank statement envelope\nTea');
  });

  test('delete_note asks first, and keeps the note if the user says no', async () => {
    const ask = jest.fn(async (_prompt: ConfirmPrompt) => false);
    const result = await run('delete_note', { id: shopping.id }, ask);
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete note?' }));
    expect(result.declined).toBe(true);
    expect(await getNote(db, shopping.id, { includePrivate: false })).not.toBeNull();
  });
});
