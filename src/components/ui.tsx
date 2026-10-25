import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { useHover } from '@/hooks/useHover';
import { noWebOutline, Radius, Spacing, useColors } from '@/theme';

import { Icon, type IconName } from './Icon';

/** Shared building blocks for the settings-style screens. */

export function Section({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      {title && <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>{children}</View>
      {footer && <Text style={[styles.footer, { color: colors.textSecondary }]}>{footer}</Text>}
    </View>
  );
}

interface RowProps {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: IconName;
  selected?: boolean;
  destructive?: boolean;
  chevron?: boolean;
  onPress?: () => void;
  right?: ReactNode;
  first?: boolean;
}

export function Row({ title, subtitle, value, icon, selected, destructive, chevron, onPress, right, first }: RowProps) {
  const colors = useColors();
  const tint = destructive ? colors.danger : colors.text;
  // `right` sits beside the pressable area, not inside it, so it can hold its own buttons.
  return (
    <View style={[styles.rowOuter, !first && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityState={selected !== undefined ? { selected } : undefined}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceStrong }]}>
        {icon && <Icon name={icon} size={20} color={destructive ? colors.danger : colors.textSecondary} />}
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: tint }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>
        {value && (
          <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>
            {value}
          </Text>
        )}
        {selected && <Icon name="check" size={20} color={colors.accent} />}
        {chevron && <Icon name="chevronRight" size={18} color={colors.textSecondary} />}
      </Pressable>
      {right && <View style={styles.rowRight}>{right}</View>}
    </View>
  );
}

export function Field({
  label,
  hint,
  right,
  ...input
}: TextInputProps & { label: string; hint?: string; right?: ReactNode }) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const { hovered, hoverProps } = useHover();
  const borderColor = focused ? colors.accent : hovered ? colors.borderStrong : colors.border;
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View {...hoverProps} style={[styles.fieldBox, { backgroundColor: colors.surface, borderColor }]}>
        <TextInput
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[styles.fieldInput, input.multiline && styles.fieldMultiline, noWebOutline, { color: colors.text }]}
          accessibilityLabel={label}
        />
        {right}
      </View>
      {hint && <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text>}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  const colors = useColors();
  const background =
    variant === 'primary' ? colors.accent : variant === 'danger' ? colors.dangerSurface : colors.surface;
  const foreground = variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} color={foreground} />}
          <Text style={[styles.buttonText, { color: foreground }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** A pill for picking one option from a short list. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        { backgroundColor: selected ? colors.accent : colors.surface, borderColor: selected ? colors.accent : colors.border },
      ]}>
      <Text style={[styles.chipText, { color: selected ? colors.onAccent : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  color,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: colors.surface }]}>
      <Icon name={icon} size={22} color={color ?? colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: Spacing.xs },
  card: { borderRadius: Radius.md, overflow: 'hidden' },
  footer: { fontSize: 13, lineHeight: 18, marginHorizontal: Spacing.xs },
  rowOuter: { flexDirection: 'row', alignItems: 'center' },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: 14, minHeight: 52 },
  rowRight: { paddingRight: Spacing.md },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16 },
  rowSubtitle: { fontSize: 13 },
  rowValue: { fontSize: 15, maxWidth: '50%' },
  fieldWrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', marginLeft: Spacing.xs },
  fieldBox: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, paddingRight: Spacing.xs },
  fieldInput: { flex: 1, fontSize: 16, paddingHorizontal: Spacing.lg, paddingVertical: 12 },
  fieldMultiline: { minHeight: 112, lineHeight: 22, textAlignVertical: 'top' },
  hint: { fontSize: 13, lineHeight: 18, marginHorizontal: Spacing.xs },
  button: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: Spacing.lg },
  buttonText: { fontSize: 16, fontWeight: '600' },
  chip: { borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 14, fontWeight: '500' },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
