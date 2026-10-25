import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ModelPicker } from '@/components/ModelPicker';
import { Chip, Row, Section } from '@/components/ui';
import { addRecentModels, listRecentModels, updateProvider, type RecentModel } from '@/db/providersRepo';
import { getApiKey } from '@/lib/secrets';
import { goBack } from '@/lib/navigation';
import { useActiveProvider, useProviderStore } from '@/store/providerStore';
import { Spacing, useColors } from '@/theme';

/** Switches the provider and model you chat with: from recent picks, or any provider's model list. */
export default function ModelsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const colors = useColors();
  const providers = useProviderStore((s) => s.providers);
  const load = useProviderStore((s) => s.load);
  const setActive = useProviderStore((s) => s.setActive);
  const active = useActiveProvider();
  const [browsingId, setBrowsingId] = useState<number | null>(null);
  const browsing = providers.find((p) => p.id === browsingId) ?? active ?? providers[0];
  // Tagged with its provider, so a key still loading is never used for another provider.
  const [apiKey, setApiKey] = useState<{ providerId: number; key: string } | null>(null);
  const [recent, setRecent] = useState<RecentModel[]>([]);

  const browsingIdNow = browsing?.id;
  useEffect(() => {
    if (browsingIdNow !== undefined) getApiKey(browsingIdNow).then((key) => setApiKey({ providerId: browsingIdNow, key }));
  }, [browsingIdNow]);

  useEffect(() => {
    listRecentModels(db).then(setRecent);
  }, [db]);

  if (!browsing) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Add a provider in Settings first.</Text>
      </View>
    );
  }

  const choose = async (providerId: number, model: string) => {
    // The model being left goes into the recent list too, so switching back is one tap.
    await addRecentModels(db, [{ providerId, model }, ...(active?.model ? [{ providerId: active.id, model: active.model }] : [])]);
    await updateProvider(db, providerId, { model });
    await setActive(db, providerId);
    await load(db);
    goBack(router);
  };

  const recentRows = recent.flatMap((r) => {
    const provider = providers.find((p) => p.id === r.providerId);
    return provider ? [{ ...r, provider }] : [];
  });

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {recentRows.length > 0 && (
        <Section title="Recent">
          {recentRows.map((r, i) => (
            <Row
              key={`${r.providerId}:${r.model}`}
              first={i === 0}
              title={r.model}
              subtitle={r.provider.name}
              selected={r.providerId === active?.id && r.model === active?.model}
              onPress={() => choose(r.providerId, r.model)}
            />
          ))}
        </Section>
      )}

      {providers.length > 1 && (
        <View style={styles.chips}>
          {providers.map((p) => (
            <Chip key={p.id} label={p.name} selected={p.id === browsing.id} onPress={() => setBrowsingId(p.id)} />
          ))}
        </View>
      )}

      <Text style={[styles.caption, { color: colors.textSecondary }]}>Models from {browsing.name}</Text>
      {apiKey?.providerId === browsing.id && (
        <ModelPicker
          key={browsing.id}
          config={{ kind: browsing.kind, baseUrl: browsing.baseUrl, apiKey: apiKey.key }}
          selected={browsing.id === active?.id ? browsing.model : ''}
          onSelect={(model) => choose(browsing.id, model)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  caption: { fontSize: 13, marginLeft: Spacing.xs, marginBottom: -Spacing.xs },
});
