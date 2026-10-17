import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import type { ProviderConfig } from '@/ai/llm';
import { listProviders, type ProviderProfile } from '@/db/providersRepo';
import { getSetting, setSetting } from '@/db/settingsRepo';
import { getApiKey } from '@/lib/secrets';

interface ProviderState {
  loaded: boolean;
  providers: ProviderProfile[];
  activeId: number | null;
  /** Reloads profiles from the database, fixing the active profile if it was deleted. */
  load: (db: SQLiteDatabase) => Promise<void>;
  setActive: (db: SQLiteDatabase, id: number) => Promise<void>;
}

export const useProviderStore = create<ProviderState>((set) => ({
  loaded: false,
  providers: [],
  activeId: null,

  load: async (db) => {
    const providers = await listProviders(db);
    const stored = Number(await getSetting(db, 'active_provider_id'));
    let activeId = providers.some((p) => p.id === stored) ? stored : (providers[0]?.id ?? null);
    if (activeId !== stored) {
      await setSetting(db, 'active_provider_id', activeId === null ? null : String(activeId));
    }
    set({ loaded: true, providers, activeId });
  },

  setActive: async (db, id) => {
    await setSetting(db, 'active_provider_id', String(id));
    set({ activeId: id });
  },
}));

export function useActiveProvider(): ProviderProfile | null {
  return useProviderStore((s) => s.providers.find((p) => p.id === s.activeId) ?? null);
}

/** Everything chat() needs for the active profile, including its API key from secure storage. */
export async function activeProviderConfig(): Promise<ProviderConfig | null> {
  const { providers, activeId } = useProviderStore.getState();
  const profile = providers.find((p) => p.id === activeId);
  if (!profile) return null;
  return {
    kind: profile.kind,
    baseUrl: profile.baseUrl,
    model: profile.model,
    apiKey: await getApiKey(profile.id),
  };
}
