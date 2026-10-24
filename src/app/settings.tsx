import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { presetById } from '@/ai/presets';
import { IconButton, Row, Section } from '@/components/ui';
import { deleteAllConversations } from '@/db/conversationsRepo';
import { deleteMemory, listMemories, type Memory } from '@/db/memoriesRepo';
import { confirm } from '@/lib/confirm';
import { allowExactReminders, exactRemindersAllowed } from '@/services/reminders';
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
  const [memories, setMemories] = useState<Memory[]>([]);
  // null until known, or when this build has no reminders.
  const [exactReminders, setExactReminders] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      listMemories(db).then(setMemories);
      exactRemindersAllowed().then(setExactReminders, () => setExactReminders(null));
    }, [db])
  );

  const clearHistory = async () => {
    if (!(await confirm('Clear conversation history?', 'Every chat will be deleted from this phone.', 'Clear'))) return;
    await deleteAllConversations(db);
    useChatStore.getState().forget('all');
  };

  const removeMemory = async (memory: Memory) => {
    if (!(await confirm('Forget this?', `Nova will forget: “${memory.text}”`, 'Forget'))) return;
    await deleteMemory(db, memory.id);
    setMemories((list) => list.filter((m) => m.id !== memory.id));
  };

  const allowExact = async () => {
    setExactReminders(await allowExactReminders().catch(() => null));
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

      <Section
        title="Memory"
        footer="Facts Nova saved when you asked it to remember something. They are sent with every message, so Nova knows them in any chat.">
        {memories.length === 0 ? (
          <Row first icon="memory" title="Nothing remembered yet" subtitle='Try "Remember that I prefer short replies".' />
        ) : (
          memories.map((memory, i) => (
            <Row
              key={memory.id}
              first={i === 0}
              title={memory.text}
              right={
                <IconButton
                  icon="delete"
                  label={`Forget ${memory.text}`}
                  color={colors.textSecondary}
                  onPress={() => removeMemory(memory)}
                />
              }
            />
          ))
        )}
      </Section>

      {process.env.EXPO_OS === 'android' && (
        <Section
          title="Reminders"
          footer="Lets reminders arrive at the exact minute. Without it, Android may deliver them a few minutes late to save battery.">
          <Row
            first
            icon="reminder"
            title="Exact reminder times"
            value={exactReminders === null ? 'Unavailable' : exactReminders ? 'On' : 'Off'}
            chevron={exactReminders === false}
            onPress={exactReminders === false ? allowExact : undefined}
          />
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
