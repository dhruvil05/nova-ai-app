import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Note } from '@/db/notesRepo';
import { formatDate } from '@/lib/format';
import { Radius, Spacing, useColors } from '@/theme';

import { Icon } from './Icon';

/** The title to show: the note's own, or else its first line. */
export function noteTitle(note: Pick<Note, 'title' | 'body'>) {
  return note.title.trim() || note.body.trim().split('\n')[0] || 'Untitled';
}

/** A note in the list: title, the start of the text, date, and badges for private and AI-written notes. */
export const NoteCard = memo(function NoteCard({ note, onPress }: { note: Note; onPress: () => void }) {
  const colors = useColors();
  const title = noteTitle(note);
  // Without a title the first line is already the heading, so the preview starts after it.
  const preview = (note.title.trim() ? note.body : note.body.trim().split('\n').slice(1).join('\n')).replace(/\s+/g, ' ').trim();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${note.isPrivate ? ', private' : ''}${note.createdBy === 'ai' ? ', written by Nova' : ''}`}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? colors.surfaceStrong : colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {note.isPrivate && <Icon name="lock" size={16} color={colors.textSecondary} />}
        {note.createdBy === 'ai' && (
          <View style={[styles.badge, { backgroundColor: colors.surfaceStrong }]}>
            <Icon name="sparkles" size={12} color={colors.accent} />
            <Text style={[styles.badgeText, { color: colors.accent }]}>AI</Text>
          </View>
        )}
      </View>
      {!!preview && (
        <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={2}>
          {preview}
        </Text>
      )}
      <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(note.updatedAt)}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: Radius.md, padding: Spacing.lg, gap: Spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { flex: 1, fontSize: 16, fontWeight: '600' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: Radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  preview: { fontSize: 14, lineHeight: 20 },
  date: { fontSize: 12, marginTop: 2 },
});
