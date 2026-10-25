import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Composer } from '@/components/Composer';
import { Icon } from '@/components/Icon';
import { MessageBubble, type MessageBubbleProps } from '@/components/MessageBubble';
import { Button, IconButton } from '@/components/ui';
import { toolResultsAfter, type Message } from '@/db/conversationsRepo';
import { awaitsReply, useChatStore } from '@/store/chatStore';
import { useActiveProvider, useProviderStore } from '@/store/providerStore';
import { Radius, Spacing, useColors } from '@/theme';

type Item = { key: string; bubble: MessageBubbleProps };

/** Sent when the user taps Continue under a reply that was cut off. */
const CONTINUE_PROMPT = 'Continue from where you stopped.';

export default function ChatScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const colors = useColors();
  const provider = useActiveProvider();
  const providersLoaded = useProviderStore((s) => s.loaded);
  const { messages, streaming, error, send, retry, regenerate, editLast, stop, open } = useChatStore();
  const busy = streaming !== null;
  const continueReply = useCallback(() => send(db, CONTINUE_PROMPT), [db, send]);
  const regenerateReply = useCallback(() => regenerate(db), [db, regenerate]);

  // Editing ends by itself once a reply starts or the message is gone (another chat was opened).
  const [editing, setEditing] = useState<Message | null>(null);
  const editTarget = editing && !busy && messages.some((m) => m.id === editing.id) ? editing : null;

  // Saved messages, with each tool result folded into the card of the call that asked for it.
  const saved = useMemo(() => {
    const lastUser = messages.findLastIndex((m) => m.role === 'user');
    const list: Item[] = [];
    messages.forEach((m, i) => {
      if (m.role === 'user') {
        list.push({
          key: String(m.id),
          bubble: { role: 'user', text: m.text, onEdit: i === lastUser && !busy ? () => setEditing(m) : undefined },
        });
      } else if (m.role === 'assistant') {
        const results = toolResultsAfter(messages, i);
        const isLast = i === messages.length - 1;
        list.push({
          key: String(m.id),
          bubble: {
            role: 'assistant',
            text: m.text,
            model: m.model,
            reasoning: m.reasoning,
            cutOff: m.cutOff,
            toolsUnsupported: m.toolsUnsupported,
            onContinue: m.cutOff && isLast && !busy ? continueReply : undefined,
            onRegenerate: isLast && !busy ? regenerateReply : undefined,
            tools: m.toolCalls?.map((call) => ({
              call,
              result: results.get(call.id)?.result,
              running: busy && i > lastUser && !results.has(call.id),
            })),
          },
        });
      }
    });
    return list;
  }, [messages, busy, continueReply, regenerateReply]);

  // The list is inverted so it stays pinned to the newest message.
  const items = useMemo(() => {
    const toolsRunning = saved.some((item) => item.bubble.tools?.some((tool) => tool.running));
    // While tools run their cards show progress, so an empty draft needs no spinner of its own.
    const showDraft = streaming !== null && (!!streaming.text || !!streaming.reasoning || !toolsRunning);
    const list = showDraft
      ? [...saved, { key: 'streaming', bubble: { role: 'assistant', text: streaming.text, reasoning: streaming.reasoning, pending: true } } satisfies Item]
      : [...saved];
    return list.reverse();
  }, [saved, streaming]);

  const needsSetup = providersLoaded && !provider;
  const canRetry = !busy && !!error && awaitsReply(messages);

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <IconButton icon="history" label="Past chats" onPress={() => router.push('/conversations')} />
        <Pressable
          style={styles.titleWrap}
          onPress={() => router.push(provider ? '/models' : '/settings')}
          accessibilityRole="button"
          accessibilityLabel="Choose provider and model">
          <Text style={[styles.title, { color: colors.text }]}>Nova</Text>
          {provider && (
            <View style={styles.modelChip}>
              <Text style={[styles.modelText, { color: colors.textSecondary }]} numberOfLines={1}>
                {provider.name} · {provider.model || 'Choose a model'}
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
            renderItem={({ item }) => <MessageBubble {...item.bubble} />}
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

        <Composer
          // A new key starts the composer over, with the edited message's text or empty.
          key={editTarget ? `edit-${editTarget.id}` : 'new'}
          initialText={editTarget?.text}
          editing={!!editTarget}
          onCancelEdit={() => setEditing(null)}
          busy={busy}
          disabled={needsSetup}
          onSend={(text) => {
            if (editTarget) {
              setEditing(null);
              editLast(db, text);
            } else {
              send(db, text);
            }
          }}
          onStop={stop}
        />
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
