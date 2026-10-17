import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Composer } from '@/components/Composer';
import { Icon } from '@/components/Icon';
import { MessageBubble } from '@/components/MessageBubble';
import { Button, IconButton } from '@/components/ui';
import { useChatStore } from '@/store/chatStore';
import { useActiveProvider, useProviderStore } from '@/store/providerStore';
import { Radius, Spacing, useColors } from '@/theme';

type Item = { key: string; role: 'user' | 'assistant'; text: string; model?: string; pending?: boolean };

export default function ChatScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const colors = useColors();
  const provider = useActiveProvider();
  const providersLoaded = useProviderStore((s) => s.loaded);
  const { messages, streaming, error, send, retry, stop, open } = useChatStore();

  // The list is inverted so it stays pinned to the newest message.
  const items = useMemo(() => {
    const list: Item[] = messages.map((m) => ({ key: String(m.id), role: m.role, text: m.text, model: m.model }));
    if (streaming !== null) list.push({ key: 'streaming', role: 'assistant', text: streaming, pending: true });
    return list.reverse();
  }, [messages, streaming]);

  const busy = streaming !== null;
  const needsSetup = providersLoaded && !provider;
  const canRetry = !busy && !!error && messages[messages.length - 1]?.role === 'user';

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <IconButton icon="history" label="Past chats" onPress={() => router.push('/conversations')} />
        <Pressable
          style={styles.titleWrap}
          onPress={() => router.push(provider ? '/models' : '/settings')}
          accessibilityRole="button"
          accessibilityLabel="Choose model">
          <Text style={[styles.title, { color: colors.text }]}>Nova</Text>
          {provider && (
            <View style={styles.modelChip}>
              <Text style={[styles.modelText, { color: colors.textSecondary }]} numberOfLines={1}>
                {provider.model || 'Choose a model'}
              </Text>
              <Icon name="chevronDown" size={14} color={colors.textSecondary} />
            </View>
          )}
        </Pressable>
        <View style={styles.headerRight}>
          <IconButton icon="newChat" label="New chat" onPress={() => open(db, null)} />
          <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={process.env.EXPO_OS === 'web' ? undefined : 'padding'}>
        {needsSetup ? (
          <View style={styles.center}>
            <View style={[styles.setupCard, { backgroundColor: colors.surface }]}>
              <Icon name="sparkles" size={32} color={colors.accent} />
              <Text style={[styles.setupTitle, { color: colors.text }]}>Connect an AI service</Text>
              <Text style={[styles.setupBody, { color: colors.textSecondary }]}>
                Add your API key for OpenAI, Anthropic, Gemini, OpenRouter, Groq, or any service with an
                OpenAI-compatible base URL.
              </Text>
              <Button title="Add provider" icon="add" onPress={() => router.push({ pathname: '/provider/[id]', params: { id: 'new' } })} />
            </View>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.greeting, { color: colors.text }]}>How can I help?</Text>
          </View>
        ) : (
          <FlatList
            inverted
            data={items}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <MessageBubble role={item.role} text={item.text} model={item.model} pending={item.pending} />
            )}
            contentContainerStyle={styles.list}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          />
        )}

        {error && (
          <View style={[styles.error, { backgroundColor: colors.dangerSurface }]}>
            <Icon name="error" size={18} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            {canRetry && (
              <Pressable onPress={() => retry(db)} accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.retry, { color: colors.danger }]}>Retry</Text>
              </Pressable>
            )}
          </View>
        )}

        <Composer busy={busy} disabled={needsSetup} onSend={(text) => send(db, text)} onStop={stop} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  headerRight: { flexDirection: 'row' },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  modelChip: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: '100%' },
  modelText: { fontSize: 12, flexShrink: 1 },
  list: { padding: Spacing.lg, gap: Spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  greeting: { fontSize: 24, fontWeight: '600' },
  setupCard: { borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.md, alignItems: 'center', maxWidth: 420, width: '100%' },
  setupTitle: { fontSize: 20, fontWeight: '700' },
  setupBody: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginBottom: Spacing.sm },
  error: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.md, marginBottom: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  errorText: { flex: 1, fontSize: 14, lineHeight: 19 },
  retry: { fontSize: 14, fontWeight: '700' },
});
