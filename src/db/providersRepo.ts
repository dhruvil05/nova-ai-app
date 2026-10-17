import type { SQLiteDatabase } from 'expo-sqlite';

import type { ProviderKind } from '@/ai/llm';
import { deleteApiKey } from '@/lib/secrets';

/** A saved AI service the user can chat through. The API key is kept in secure storage. */
export interface ProviderProfile {
  id: number;
  name: string;
  presetId: string;
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  createdAt: number;
}

export type ProviderInput = Omit<ProviderProfile, 'id' | 'createdAt'>;

interface ProviderRow {
  id: number;
  name: string;
  preset_id: string;
  kind: ProviderKind;
  base_url: string;
  model: string;
  created_at: number;
}

function toProfile(row: ProviderRow): ProviderProfile {
  return {
    id: row.id,
    name: row.name,
    presetId: row.preset_id,
    kind: row.kind,
    baseUrl: row.base_url,
    model: row.model,
    createdAt: row.created_at,
  };
}

export async function listProviders(db: SQLiteDatabase): Promise<ProviderProfile[]> {
  const rows = await db.getAllAsync<ProviderRow>('SELECT * FROM providers ORDER BY created_at ASC');
  return rows.map(toProfile);
}

export async function createProvider(db: SQLiteDatabase, input: ProviderInput): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO providers (name, preset_id, kind, base_url, model, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    input.name,
    input.presetId,
    input.kind,
    input.baseUrl,
    input.model,
    Date.now()
  );
  return result.lastInsertRowId;
}

export async function updateProvider(db: SQLiteDatabase, id: number, input: Partial<ProviderInput>) {
  const current = await db.getFirstAsync<ProviderRow>('SELECT * FROM providers WHERE id = ?', id);
  if (!current) return;
  const next = { ...toProfile(current), ...input };
  await db.runAsync(
    'UPDATE providers SET name = ?, preset_id = ?, kind = ?, base_url = ?, model = ? WHERE id = ?',
    next.name,
    next.presetId,
    next.kind,
    next.baseUrl,
    next.model,
    id
  );
}

export async function deleteProvider(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM providers WHERE id = ?', id);
  await deleteApiKey(id);
}
