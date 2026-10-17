import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ModelPicker } from '@/components/ModelPicker';
import { updateProvider } from '@/db/providersRepo';
import { getApiKey } from '@/lib/secrets';
import { goBack } from '@/lib/navigation';
import { useActiveProvider, useProviderStore } from '@/store/providerStore';
import { Spacing, useColors } from '@/theme';

/** Switches the model of the active provider. */
export default function ModelsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const colors = useColors();
  const provider = useActiveProvider();
  const load = useProviderStore((s) => s.load);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    if (provider) getApiKey(provider.id).then(setApiKey);
  }, [provider]);

  if (!provider) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Add a provider in Settings first.</Text>
      </View>
    );
  }

  const select = async (model: string) => {
    await updateProvider(db, provider.id, { model });
    await load(db);
    goBack(router);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>Models from {provider.name}</Text>
      {apiKey !== null && (
        <ModelPicker
          config={{ kind: provider.kind, baseUrl: provider.baseUrl, apiKey }}
          selected={provider.model}
          onSelect={select}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: Spacing.lg, gap: Spacing.sm },
  caption: { fontSize: 13, marginLeft: Spacing.xs },
});
