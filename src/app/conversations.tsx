import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button, Field, IconButton, Row } from '@/components/ui';
import {
  deleteConversation,
  listConversations,
  searchConversations,
  type Conversation,
  type ConversationMatch,
} from '@/db/conversationsRepo';
import { confirm } from '@/lib/confirm';
import { goBack } from '@/lib/navigation';
import { useChatStore } from '@/store/chatStore';
import { Spacing, useColors } from '@/theme';

/** Waits for a pause in typing before searching. */
const SEARCH_DELAY_MS = 200;

function formatDate(ms: number) {
  const date = new Date(ms);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

/** The part of a matching message around the search text. */
function snippet(text: string, query: string) {
  const flat = text.replace(/\s+/g, ' ').trim();
  const at = Math.max(0, flat.toLowerCase().indexOf(query.trim().toLowerCase()));
  const start = Math.max(0, at - 30);
  return `${start > 0 ? '…' : ''}${flat.slice(start, start + 120)}`;
}

export default function ConversationsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationMatch[] | null>(null);
  const currentId = useChatStore((s) => s.conversationId);
  const { open, forget } = useChatStore.getState();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const timer = setTimeout(
        async () => {
          const list = query.trim() ? await searchConversations(db, query) : await listConversations(db);
          if (!cancelled) setConversations(list);
        },
        query.trim() ? SEARCH_DELAY_MS : 0
      );
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [db, query])
  );

  const remove = async (conversation: Conversation) => {
    if (!(await confirm('Delete chat?', `"${conversation.title}" will be deleted from this phone.`))) return;
    await deleteConversation(db, conversation.id);
    forget(conversation.id);
    setConversations((list) => list?.filter((c) => c.id !== conversation.id) ?? null);
  };

  const select = async (id: number | null) => {
    await open(db, id);
    goBack(router);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={conversations ?? []}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Button title="New chat" icon="newChat" variant="secondary" onPress={() => select(null)} />
            <Field
              label="Search chats"
              value={query}
              onChangeText={setQuery}
              placeholder="Words from a title or message"
              returnKeyType="search"
              right={query ? <IconButton icon="close" label="Clear search" color={colors.textSecondary} onPress={() => setQuery('')} /> : undefined}
            />
          </View>
        }
        ListEmptyComponent={
          conversations ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>{query.trim() ? 'No chats match.' : 'No chats yet.'}</Text>
          ) : undefined
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Row
              first
              title={item.title}
              subtitle={item.match ? `${formatDate(item.updatedAt)} · ${snippet(item.match, query)}` : formatDate(item.updatedAt)}
              selected={item.id === currentId}
              onPress={() => select(item.id)}
              right={<IconButton icon="delete" label={`Delete ${item.title}`} color={colors.textSecondary} onPress={() => remove(item)} />}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  header: { gap: Spacing.md, marginBottom: Spacing.xs },
  card: { borderRadius: 12, overflow: 'hidden' },
  empty: { textAlign: 'center', marginTop: Spacing.xl, fontSize: 15 },
});
