import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button, IconButton, Row } from '@/components/ui';
import { deleteConversation, listConversations, type Conversation } from '@/db/conversationsRepo';
import { confirm } from '@/lib/confirm';
import { goBack } from '@/lib/navigation';
import { useChatStore } from '@/store/chatStore';
import { Spacing, useColors } from '@/theme';

function formatDate(ms: number) {
  const date = new Date(ms);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

export default function ConversationsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const colors = useColors();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const currentId = useChatStore((s) => s.conversationId);
  const { open, forget } = useChatStore.getState();

  useFocusEffect(
    useCallback(() => {
      listConversations(db).then(setConversations);
    }, [db])
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
        ListHeaderComponent={<Button title="New chat" icon="newChat" variant="secondary" onPress={() => select(null)} />}
        ListEmptyComponent={
          conversations ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>No chats yet.</Text>
          ) : undefined
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Row
              first
              title={item.title}
              subtitle={formatDate(item.updatedAt)}
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
  card: { borderRadius: 12, overflow: 'hidden' },
  empty: { textAlign: 'center', marginTop: Spacing.xl, fontSize: 15 },
});
