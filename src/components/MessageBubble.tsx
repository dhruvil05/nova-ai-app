import * as Clipboard from 'expo-clipboard';
import { memo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, useColors } from '@/theme';

import { Markdown } from './Markdown';

interface Props {
  role: 'user' | 'assistant';
  text: string;
  model?: string;
  /** True while the reply is still streaming in. */
  pending?: boolean;
}

export const MessageBubble = memo(function MessageBubble({ role, text, model, pending }: Props) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (role === 'user') {
    return (
      <Pressable onLongPress={copy} style={styles.userRow}>
        <View style={[styles.userBubble, { backgroundColor: colors.userBubble }]}>
          <Text selectable style={[styles.userText, { color: colors.userBubbleText }]}>
            {text}
          </Text>
        </View>
        {copied && <Text style={[styles.meta, { color: colors.textSecondary }]}>Copied</Text>}
      </Pressable>
    );
  }

  return (
    <Pressable onLongPress={pending ? undefined : copy} style={styles.assistantRow}>
      {text ? (
        <Markdown text={text} color={colors.text} />
      ) : (
        <ActivityIndicator color={colors.textSecondary} style={styles.spinner} />
      )}
      {!pending && (copied || model) && (
        <Text style={[styles.meta, { color: colors.textSecondary }]}>{copied ? 'Copied' : model}</Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  userRow: { alignItems: 'flex-end', paddingLeft: 48 },
  userBubble: {
    borderRadius: Radius.lg,
    borderBottomRightRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  userText: { fontSize: 16, lineHeight: 22 },
  assistantRow: { paddingRight: Spacing.md, gap: Spacing.xs },
  meta: { fontSize: 12, marginTop: Spacing.xs },
  spinner: { alignSelf: 'flex-start', marginVertical: Spacing.xs },
});
