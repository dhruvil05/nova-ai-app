import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { presetById } from '@/ai/presets';
import { Row, Section } from '@/components/ui';
import { deleteAllConversations } from '@/db/conversationsRepo';
import { confirm } from '@/lib/confirm';
import { useChatStore } from '@/store/chatStore';
import { useActiveProvider, useProviderStore } from '@/store/providerStore';
import { Spacing, useColors } from '@/theme';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const colors = useColors();
  const providers = useProviderStore((s) => s.providers);
  const activeId = useProviderStore((s) => s.activeId);
  const setActive = useProviderStore((s) => s.setActive);
  const active = useActiveProvider();

  const clearHistory = async () => {
    if (!(await confirm('Clear conversation history?', 'Every chat will be deleted from this phone.', 'Clear'))) return;
    await deleteAllConversations(db);
    useChatStore.getState().forget('all');
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <Section
        title="AI provider"
        footer="Tap a provider to chat with it. API keys stay in this phone's secure storage and are only sent to the provider they belong to.">
        {providers.map((p, i) => (
          <Row
            key={p.id}
            first={i === 0}
            title={p.name}
            subtitle={`${presetById(p.presetId).label} · ${p.model || 'No model chosen'}`}
            selected={p.id === activeId}
            onPress={() => setActive(db, p.id)}
            right={
              <Pressable
                onPress={() => router.push({ pathname: '/provider/[id]', params: { id: String(p.id) } })}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${p.name}`}>
                <Text style={[styles.edit, { color: colors.accent }]}>Edit</Text>
              </Pressable>
            }
          />
        ))}
        <Row
          first={providers.length === 0}
          icon="add"
          title="Add provider"
          onPress={() => router.push({ pathname: '/provider/[id]', params: { id: 'new' } })}
        />
      </Section>

      {active && (
        <Section title="Model" footer={`Used for every new message sent through ${active.name}.`}>
          <Row first title="Model" value={active.model || 'Choose'} chevron onPress={() => router.push('/models')} />
        </Section>
      )}

      <Section title="Data">
        <Row first icon="delete" title="Clear conversation history" destructive onPress={clearHistory} />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.xl },
  edit: { fontSize: 15, fontWeight: '600' },
});
