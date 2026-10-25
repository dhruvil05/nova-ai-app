import * as Clipboard from 'expo-clipboard';
import { memo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, useColors } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Markdown } from './Markdown';
import { ToolCard, type ToolCardProps } from './ToolCard';

export interface MessageBubbleProps {
  role: 'user' | 'assistant';
  text: string;
  model?: string;
  /** A reasoning model's thinking, shown folded above the answer. */
  reasoning?: string;
  /** The tools this reply called, each with its result once it has run. */
  tools?: ToolCardProps[];
  /** True while the reply is still streaming in. */
  pending?: boolean;
  /** The reply hit the length limit. */
  cutOff?: boolean;
  toolsUnsupported?: boolean;
  /** Offered on a cut-off reply when it is the latest message. */
  onContinue?: () => void;
  /** Offered on the latest reply. */
  onRegenerate?: () => void;
  /** Offered on the user's last message. */
  onEdit?: () => void;
}

export const MessageBubble = memo(function MessageBubble({
  role,
  text,
  model,
  reasoning,
  tools,
  pending,
  cutOff,
  toolsUnsupported,
  onContinue,
  onRegenerate,
  onEdit,
}: MessageBubbleProps) {
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
        {onEdit && !copied && <ActionButton icon="edit" label="Edit message" onPress={onEdit} />}
      </Pressable>
    );
  }

  // The footer goes under the answer, not under each step of a tool run.
  const answer = !!text && !tools?.length;
  const showFooter = !pending && (answer || !!onRegenerate);
  const meta = copied ? 'Copied' : answer ? [model, toolsUnsupported && 'no tool support'].filter(Boolean).join(' · ') : '';

  return (
    <Pressable onLongPress={pending || !text ? undefined : copy} style={styles.assistantRow}>
      {!!reasoning && <Reasoning text={reasoning} thinking={!!pending && !text} />}
      {text ? (
        <Markdown text={text} color={colors.text} />
      ) : (
        pending && !reasoning && <ActivityIndicator color={colors.textSecondary} style={styles.spinner} />
      )}
      {tools?.map((tool) => <ToolCard key={tool.call.id} {...tool} />)}
      {cutOff && (
        <View style={[styles.cutOff, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cutOffText, { color: colors.textSecondary }]}>This reply was cut off at the length limit.</Text>
          {onContinue && (
            <Pressable onPress={onContinue} accessibilityRole="button" hitSlop={8} style={styles.continue}>
              <Text style={[styles.continueText, { color: colors.accent }]}>Continue</Text>
              <Icon name="forward" size={16} color={colors.accent} />
            </Pressable>
          )}
        </View>
      )}
      {showFooter && (
        <View style={styles.footer}>
          {!!text && <ActionButton icon={copied ? 'check' : 'copy'} label="Copy reply" onPress={copy} />}
          {onRegenerate && <ActionButton icon="refresh" label="Regenerate reply" onPress={onRegenerate} />}
          {!!meta && (
            <Text style={[styles.meta, styles.footerMeta, { color: colors.textSecondary }]} numberOfLines={1}>
              {meta}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
});

function ActionButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surface }]}>
      <Icon name={icon} size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

/** A reasoning model's thinking, folded by default so the answer stays in front. */
function Reasoning({ text, thinking }: { text: string; thinking: boolean }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.reasoning}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={styles.reasoningHeader}>
        {thinking ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <Icon name="thinking" size={16} color={colors.textSecondary} />
        )}
        <Text style={[styles.reasoningTitle, { color: colors.textSecondary }]}>{thinking ? 'Thinking…' : 'Thought process'}</Text>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <Text selectable style={[styles.reasoningText, { color: colors.textSecondary, borderLeftColor: colors.border }]}>
          {text.trim()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: { alignItems: 'flex-end', paddingLeft: 48, gap: Spacing.xs },
  userBubble: {
    borderRadius: Radius.lg,
    borderBottomRightRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  userText: { fontSize: 16, lineHeight: 22 },
  assistantRow: { paddingRight: Spacing.md, gap: Spacing.sm },
  meta: { fontSize: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6 },
  footerMeta: { flexShrink: 1, marginLeft: 4 },
  action: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  spinner: { alignSelf: 'flex-start', marginVertical: Spacing.xs },
  reasoning: { gap: Spacing.sm },
  reasoningHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start' },
  reasoningTitle: { fontSize: 14, fontWeight: '500' },
  reasoningText: { fontSize: 14, lineHeight: 20, borderLeftWidth: 2, paddingLeft: Spacing.md },
  cutOff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  cutOffText: { flex: 1, fontSize: 13, lineHeight: 18 },
  continue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  continueText: { fontSize: 14, fontWeight: '700' },
});
