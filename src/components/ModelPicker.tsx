import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { listModels, type ModelInfo, type ProviderConfig } from '@/ai/llm';
import { Spacing, useColors } from '@/theme';

import { Button, Field, Row } from './ui';

interface Props {
  config: Omit<ProviderConfig, 'model'>;
  selected: string;
  onSelect: (model: string) => void;
}

/**
 * Lists the models a provider offers, with search. When the provider has no
 * model list, or the model isn't in it, the user can type the name instead.
 */
export function ModelPicker({ config, selected, onSelect }: Props) {
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; models?: ModelInfo[]; error?: string } | null>(null);
  const { kind, baseUrl, apiKey } = config;

  // Each fetch is tagged with its inputs, so a stale result is never shown for new ones.
  const requestKey = JSON.stringify([kind, baseUrl, apiKey, attempt]);
  const missingUrl = !baseUrl.trim();

  useEffect(() => {
    if (missingUrl) return;
    let cancelled = false;
    listModels({ kind, baseUrl, apiKey })
      .then((list) => !cancelled && setResult({ key: requestKey, models: list }))
      .catch((e: unknown) => !cancelled && setResult({ key: requestKey, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
    };
  }, [kind, baseUrl, apiKey, requestKey, missingUrl]);

  const current = result?.key === requestKey ? result : null;
  const loading = !missingUrl && !current;
  const error = missingUrl ? 'Enter a base URL first.' : (current?.error ?? null);
  const models = current?.models ?? null;

  const typed = query.trim();
  const filtered = useMemo(() => {
    const q = typed.toLowerCase();
    if (!models) return [];
    return q ? models.filter((m) => m.id.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q)) : models;
  }, [models, typed]);
  const showTyped = typed.length > 0 && !filtered.some((m) => m.id === typed);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Field
          label="Search or type a model name"
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. gpt-4o-mini, llama3.2"
          returnKeyType="done"
          onSubmitEditing={() => typed && onSelect(typed)}
        />
        {showTyped && <Button title={`Use "${typed}"`} variant="secondary" onPress={() => onSelect(typed)} />}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.status} color={colors.textSecondary} />
      ) : error ? (
        <View style={styles.status}>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{error}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            You can still type the model name above.
          </Text>
          <Button title="Try again" icon="refresh" variant="secondary" onPress={() => setAttempt((n) => n + 1)} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {models?.length ? 'No models match.' : 'This provider returned no models.'}
            </Text>
          }
          renderItem={({ item, index }) => (
            <Row
              first={index === 0}
              title={item.name ?? item.id}
              subtitle={item.name ? item.id : undefined}
              selected={item.id === selected}
              onPress={() => onSelect(item.id)}
            />
          )}
          style={[styles.listBox, { backgroundColor: colors.surface }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: Spacing.md },
  header: { gap: Spacing.sm },
  status: { padding: Spacing.lg, gap: Spacing.md, alignItems: 'stretch' },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  listBox: { flex: 1, borderRadius: 12 },
  list: { flexGrow: 1 },
});
