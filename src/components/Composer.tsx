import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useHover } from '@/hooks/useHover';
import { noWebOutline, Radius, Spacing, useColors } from '@/theme';

import { Icon } from './Icon';

const LINE_HEIGHT = 22;
const PADDING_Y = 9;
const MIN_HEIGHT = LINE_HEIGHT + PADDING_Y * 2;
const MAX_HEIGHT = LINE_HEIGHT * 6 + PADDING_Y * 2;

interface Props {
  busy: boolean;
  disabled?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  /** Text to start with, such as a message being edited. Read once, so give the Composer a new key to change it. */
  initialText?: string;
  /** Shows that sending will replace the user's last message, with a way to cancel. */
  editing?: boolean;
  onCancelEdit?: () => void;
}

export function Composer({ busy, disabled, onSend, onStop, initialText = '', editing, onCancelEdit }: Props) {
  const colors = useColors();
  const [text, setText] = useState(initialText);
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [focused, setFocused] = useState(false);
  const { hovered, hoverProps } = useHover();
  const canSend = !busy && !disabled && text.trim().length > 0;

  const send = () => {
    if (!canSend) return;
    onSend(text);
    setText('');
    setHeight(MIN_HEIGHT);
  };

  const borderColor = focused ? colors.accent : hovered && !disabled ? colors.borderStrong : colors.border;

  return (
    <View style={[styles.bar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
      {editing && (
        <View style={styles.editBar}>
          <Icon name="edit" size={14} color={colors.textSecondary} />
          <Text style={[styles.editText, { color: colors.textSecondary }]}>Editing your message</Text>
          <Pressable onPress={onCancelEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel editing">
            <Text style={[styles.editCancel, { color: colors.accent }]}>Cancel</Text>
          </Pressable>
        </View>
      )}
      <View
        {...hoverProps}
        style={[styles.field, { backgroundColor: colors.surface, borderColor }, disabled && styles.disabled]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message Nova"
          placeholderTextColor={colors.textSecondary}
          multiline
          editable={!disabled}
          autoFocus={editing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // Grow with the text, up to six lines, then scroll.
          onContentSizeChange={(e) =>
            setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.ceil(e.nativeEvent.contentSize.height))))
          }
          onKeyPress={(e) => {
            // On web, Enter sends and Shift+Enter adds a line.
            const native = e.nativeEvent as { key: string; shiftKey?: boolean };
            if (native.key === 'Enter' && !native.shiftKey && process.env.EXPO_OS === 'web') {
              e.preventDefault();
              send();
            }
          }}
          style={[styles.input, noWebOutline, { color: colors.text, height }]}
          accessibilityLabel="Message"
        />
        <SendButton busy={busy} canSend={canSend} onSend={send} onStop={onStop} />
      </View>
    </View>
  );
}

function SendButton({
  busy,
  canSend,
  onSend,
  onStop,
}: {
  busy: boolean;
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
}) {
  const colors = useColors();
  const [hovered, setHovered] = useState(false);
  const active = busy || canSend;
  const background = busy ? colors.text : canSend ? colors.accent : colors.surfaceStrong;

  return (
    <Pressable
      onPress={busy ? onStop : onSend}
      disabled={!active}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityLabel={busy ? 'Stop reply' : 'Send message'}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: active && pressed ? 0.7 : active && hovered ? 0.85 : 1 },
      ]}>
      {busy ? (
        <Icon name="stop" size={16} color={colors.background} />
      ) : (
        <Icon name="send" size={18} color={canSend ? colors.onAccent : colors.textSecondary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: Spacing.lg,
    paddingRight: 5,
    paddingVertical: 5,
  },
  disabled: { opacity: 0.6 },
  editBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm },
  editText: { flex: 1, fontSize: 13 },
  editCancel: { fontSize: 13, fontWeight: '700' },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: LINE_HEIGHT,
    paddingTop: PADDING_Y,
    paddingBottom: PADDING_Y,
    paddingHorizontal: 0,
    textAlignVertical: 'top',
  },
  button: {
    width: 36,
    height: 36,
    marginBottom: (MIN_HEIGHT - 36) / 2,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
