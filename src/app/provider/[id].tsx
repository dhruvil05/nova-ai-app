import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ProviderKind } from '@/ai/llm';
import { PRESETS, presetById } from '@/ai/presets';
import { ModelPicker } from '@/components/ModelPicker';
import { Button, Field, IconButton } from '@/components/ui';
import { createProvider, deleteProvider, updateProvider } from '@/db/providersRepo';
import { confirm } from '@/lib/confirm';
import { goBack } from '@/lib/navigation';
import { getApiKey, setApiKey } from '@/lib/secrets';
import { useProviderStore } from '@/store/providerStore';
import { Radius, Spacing, useColors } from '@/theme';

const KINDS: { kind: ProviderKind; label: string }[] = [
  { kind: 'openai', label: 'OpenAI-compatible' },
  { kind: 'anthropic', label: 'Anthropic' },
];

function validUrl(url: string) {
  return /^https?:\/\/[^\s/]+/i.test(url.trim());
}

/** Adds (id = "new") or edits a provider profile. */
export default function ProviderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const db = useSQLiteContext();
  const router = useRouter();
  const colors = useColors();
  const { providers, activeId, load, setActive } = useProviderStore();
  const existing = isNew ? undefined : providers.find((p) => p.id === Number(id));

  const [presetId, setPresetId] = useState(existing?.presetId ?? 'openai');
  const [name, setName] = useState(existing?.name ?? presetById('openai').label);
  const [kind, setKind] = useState<ProviderKind>(existing?.kind ?? 'openai');
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? presetById('openai').baseUrl);
  const [apiKey, setKey] = useState('');
  const [model, setModel] = useState(existing?.model ?? '');
  const [showKey, setShowKey] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = presetById(presetId);
  const flexibleFormat = presetId === 'custom' || presetId === 'local';

  useEffect(() => {
    if (existing) getApiKey(existing.id).then(setKey);
  }, [existing]);

  const choosePreset = (next: string) => {
    if (next === presetId) return;
    const p = presetById(next);
    // Keep a name the user typed; replace one that came from the old preset.
    if (!name.trim() || name === preset.label) setName(p.label);
    setPresetId(next);
    setKind(p.kind);
    setBaseUrl(p.baseUrl);
    setModel('');
    setError(null);
  };

  const save = async () => {
    const input = { name: name.trim(), presetId, kind, baseUrl: baseUrl.trim().replace(/\/+$/, ''), model: model.trim() };
    if (!input.name) return setError('Give this provider a name.');
    if (!validUrl(input.baseUrl)) return setError('Enter a base URL starting with http:// or https://.');
    if (preset.needsKey && !apiKey.trim()) return setError('Enter your API key.');
    if (!input.model) return setError('Choose or type a model.');

    setSaving(true);
    try {
      let providerId = existing?.id;
      if (providerId === undefined) {
        providerId = await createProvider(db, input);
      } else {
        await updateProvider(db, providerId, input);
      }
      await setApiKey(providerId, apiKey.trim());
      await load(db);
      // A newly added provider becomes the one you chat with.
      if (isNew || activeId === null) await setActive(db, providerId);
      goBack(router);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (!(await confirm('Delete provider?', `${existing.name} and its API key will be removed from this phone.`))) return;
    await deleteProvider(db, existing.id);
    await load(db);
    goBack(router);
  };

  if (!isNew && !existing) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>This provider no longer exists.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'Add provider' : existing?.name }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        <View style={styles.group}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Service</Text>
          <View style={styles.chips}>
            {PRESETS.map((p) => (
              <Chip key={p.id} label={p.label} selected={p.id === presetId} onPress={() => choosePreset(p.id)} />
            ))}
          </View>
          {preset.hint && <Text style={[styles.hint, { color: colors.textSecondary }]}>{preset.hint}</Text>}
        </View>

        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. My OpenRouter" autoCapitalize="words" />

        {flexibleFormat && (
          <View style={styles.group}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>API format</Text>
            <View style={styles.chips}>
              {KINDS.map((k) => (
                <Chip key={k.kind} label={k.label} selected={k.kind === kind} onPress={() => setKind(k.kind)} />
              ))}
            </View>
          </View>
        )}

        <Field
          label="Base URL"
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder={presetId === 'local' ? 'http://192.168.1.10:11434/v1' : 'https://api.example.com/v1'}
          keyboardType="url"
          hint={kind === 'anthropic' ? 'Requests go to <base URL>/messages.' : 'Requests go to <base URL>/chat/completions.'}
        />

        <Field
          label={preset.needsKey ? 'API key' : 'API key (optional)'}
          value={apiKey}
          onChangeText={setKey}
          placeholder={preset.needsKey ? 'Paste your key' : 'Leave empty if not needed'}
          secureTextEntry={!showKey}
          right={
            <IconButton
              icon={showKey ? 'hide' : 'show'}
              label={showKey ? 'Hide API key' : 'Show API key'}
              color={colors.textSecondary}
              onPress={() => setShowKey((v) => !v)}
            />
          }
        />

        <View style={styles.group}>
          <Field label="Model" value={model} onChangeText={setModel} placeholder="Choose from the list or type a name" />
          <Button title="Browse models" icon="search" variant="secondary" onPress={() => setPicking(true)} />
        </View>

        {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

        <Button title={isNew ? 'Add provider' : 'Save'} onPress={save} loading={saving} />
        {!isNew && <Button title="Delete provider" variant="danger" icon="delete" onPress={remove} />}
      </ScrollView>

      <Modal visible={picking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicking(false)}>
        <SafeAreaView style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choose model</Text>
            <Button title="Close" variant="secondary" onPress={() => setPicking(false)} />
          </View>
          <ModelPicker
            config={{ kind, baseUrl, apiKey: apiKey.trim() }}
            selected={model}
            onSelect={(m) => {
              setModel(m);
              setPicking(false);
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        { backgroundColor: selected ? colors.accent : colors.surface, borderColor: selected ? colors.accent : colors.border },
      ]}>
      <Text style={[styles.chipText, { color: selected ? colors.onAccent : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xl * 2 },
  group: { gap: Spacing.sm },
  label: { fontSize: 13, fontWeight: '600', marginLeft: Spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 14, fontWeight: '500' },
  hint: { fontSize: 13, lineHeight: 18, marginHorizontal: Spacing.xs },
  error: { fontSize: 14, lineHeight: 20 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 20, fontWeight: '700' },
});
