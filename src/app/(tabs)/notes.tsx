import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { NoteCard } from '@/components/NoteCard';
import { Chip, Field, IconButton } from '@/components/ui';
import { countPrivateNotes, listNotes, searchNotes, type Note, type NoteFilter } from '@/db/notesRepo';
import { useNotesStore } from '@/store/notesStore';
import { usePrivacyStore } from '@/store/privacyStore';
import { Radius, Spacing, useColors } from '@/theme';

const FILTERS: { filter: NoteFilter; label: string }[] = [
  { filter: 'all', label: 'All' },
  { filter: 'public', label: 'Public' },
  { filter: 'private', label: 'Private' },
];

/** Waits for a pause in typing before searching. */
const SEARCH_DELAY_MS = 200;

export default function NotesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const colors = useColors();
  const unlocked = usePrivacyStore((s) => s.unlocked);
  const { unlock, lock } = usePrivacyStore.getState();
  const [query, setQuery] = useState('');
  const [chosenFilter, setFilter] = useState<NoteFilter>('all');
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [privateCount, setPrivateCount] = useState(0);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  // Locking again (e.g. after Nova went to the background) leaves the Private filter.
  const filter = chosenFilter === 'private' && !unlocked ? 'all' : chosenFilter;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      // Private notes show only while unlocked; locked, they're left out of the list and search.
      const access = { includePrivate: unlocked };
      const load = (delay: number) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(async () => {
          const [list, count] = await Promise.all([
            query.trim() ? searchNotes(db, query, access, { filter }) : listNotes(db, access, { filter }),
            countPrivateNotes(db),
          ]);
          if (cancelled) return;
          setNotes(list);
          setPrivateCount(count);
        }, delay);
      };
      load(query.trim() ? SEARCH_DELAY_MS : 0);
      // An editor's last save can land just after this screen regains focus, so reload when it does.
      const unsubscribe = useNotesStore.subscribe(() => load(0));
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
        unsubscribe();
      };
    }, [db, query, filter, unlocked])
  );

  /** Unlocks, then runs `then`. Cancelling does nothing; other failures are shown. */
  const unlockThen = async (then?: () => void) => {
    setUnlockError(null);
    const result = await unlock();
    if (result.unlocked) then?.();
    else if (result.reason) setUnlockError(result.reason);
  };

  const chooseFilter = (next: NoteFilter) => {
    if (next === 'private' && !unlocked) unlockThen(() => setFilter('private'));
    else setFilter(next);
  };

  const openNote = (id: number | 'new') => router.push({ pathname: '/note/[id]', params: { id: String(id) } });
  const hidden = !unlocked && privateCount > 0;
  // The list reloads only when it next has focus, so a lock while it's covered must not leave private notes showing.
  const visibleNotes = unlocked ? notes : (notes?.filter((note) => !note.isPrivate) ?? null);

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Notes</Text>
        {unlocked && privateCount > 0 && <IconButton icon="lock" label="Lock private notes" onPress={lock} />}
        <IconButton icon="add" label="New note" onPress={() => openNote('new')} />
      </View>
      <FlatList
        data={visibleNotes ?? []}
        keyExtractor={(note) => String(note.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={styles.controls}>
            <Field
              label="Search notes"
              value={query}
              onChangeText={setQuery}
              placeholder="Words from a title or note"
              returnKeyType="search"
              right={query ? <IconButton icon="close" label="Clear search" color={colors.textSecondary} onPress={() => setQuery('')} /> : undefined}
            />
            <View style={styles.chips}>
              {FILTERS.map((f) => (
                <Chip key={f.filter} label={f.label} selected={f.filter === filter} onPress={() => chooseFilter(f.filter)} />
              ))}
            </View>
            {hidden && (
              <Pressable
                onPress={() => unlockThen()}
                accessibilityRole="button"
                accessibilityLabel={`Unlock ${privateCount} private ${privateCount === 1 ? 'note' : 'notes'}`}
                style={({ pressed }) => [styles.locked, { backgroundColor: pressed ? colors.surfaceStrong : colors.surface }]}>
                <Icon name="lock" size={18} color={colors.accent} />
                <Text style={[styles.lockedText, { color: colors.text }]}>
                  {privateCount} private {privateCount === 1 ? 'note' : 'notes'} hidden
                </Text>
                <Text style={[styles.lockedAction, { color: colors.accent }]}>Unlock</Text>
              </Pressable>
            )}
            {unlockError && <Text style={[styles.error, { color: colors.danger }]}>{unlockError}</Text>}
          </View>
        }
        ListEmptyComponent={
          visibleNotes && !hidden ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {query.trim() ? 'No notes match.' : filter === 'private' ? 'No private notes.' : 'No notes yet. Tap + to write one.'}
            </Text>
          ) : undefined
        }
        renderItem={({ item }) => <NoteCard note={item} onPress={() => openNote(item.id)} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: Spacing.lg, paddingRight: Spacing.sm, paddingVertical: Spacing.xs },
  title: { flex: 1, fontSize: 24, fontWeight: '700' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  controls: { gap: Spacing.md, marginBottom: Spacing.xs },
  chips: { flexDirection: 'row', gap: Spacing.sm },
  locked: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, padding: Spacing.lg },
  lockedText: { flex: 1, fontSize: 15 },
  lockedAction: { fontSize: 15, fontWeight: '700' },
  error: { fontSize: 14, lineHeight: 20 },
  empty: { textAlign: 'center', marginTop: Spacing.xl, fontSize: 15, lineHeight: 21 },
});
