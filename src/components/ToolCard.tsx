import { memo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ToolCall } from '@/ai/llm';
import { findTool, type ToolResult } from '@/ai/tools';
import { Radius, Spacing, useColors } from '@/theme';

import { Icon } from './Icon';

export interface ToolCardProps {
  call: ToolCall;
  /** What the tool returned, once it has run. */
  result?: ToolResult;
  running: boolean;
}

/** Shows that the AI used a tool, and how it went. Tap to see the exact input and result. */
export const ToolCard = memo(function ToolCard({ call, result, running }: ToolCardProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const tool = findTool(call.name);
  const error = typeof result?.error === 'string' ? result.error : null;
  const declined = result?.declined === true;
  const succeeded = !!result && !error && !declined;

  const label = tool ? tool.label(call.input, succeeded ? result : undefined) : `Used ${call.name}`;
  const status = running ? null : !result ? 'Stopped before it ran' : error ? error : declined ? 'You said no' : null;
  const failed = !running && !succeeded;

  return (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={`${label}${status ? `. ${status}` : ''}`}
      accessibilityState={{ expanded: open, busy: running }}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        {running ? (
          <ActivityIndicator size="small" color={colors.textSecondary} style={styles.icon} />
        ) : (
          <Icon
            name={error ? 'error' : declined || !result ? 'declined' : (tool?.icon ?? 'tool')}
            size={18}
            color={error ? colors.danger : failed ? colors.textSecondary : colors.accent}
          />
        )}
        <View style={styles.text}>
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={open ? undefined : 2}>
            {label}
          </Text>
          {status && (
            <Text style={[styles.status, { color: error ? colors.danger : colors.textSecondary }]} numberOfLines={open ? undefined : 2}>
              {status}
            </Text>
          )}
        </View>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} color={colors.textSecondary} />
      </View>
      {open && (
        <View style={[styles.details, { borderTopColor: colors.border }]}>
          <Text selectable style={[styles.code, { color: colors.textSecondary }]}>
            {`${call.name}(${JSON.stringify(call.input, null, 2)})`}
            {result && `\n→ ${JSON.stringify(result, null, 2)}`}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  icon: { width: 18, height: 18 },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
  status: { fontSize: 13, lineHeight: 18 },
  details: { borderTopWidth: StyleSheet.hairlineWidth, padding: Spacing.md },
  code: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 12, lineHeight: 17 },
});
