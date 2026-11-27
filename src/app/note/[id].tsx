import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { noteTitle } from '@/components/NoteCard';
import { Button, IconButton } from '@/components/ui';
import { createNote, deleteNote, getNote, updateNote, type Note } from '@/db/notesRepo';
import { confirm } from '@/lib/confirm';
import { goBack } from '@/lib/navigation';
import { useNotesStore } from '@/store/notesStore';
import { usePrivacyStore } from '@/store/privacyStore';
import { noWebOutline, Spacing, useColors } from '@/theme';

/** Saves this long after typing stops (spec §10.1). */
const AUTOSAVE_MS = 500;
/** The editor is the user's own view, so private notes are included. */
const ACCESS = { includePrivate: true };

/** Opens a note (id = "new" for a blank one) in the editor once it has loaded. */
export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const colors = useColors();
  const [loaded, setLoaded] = useState<{ id: string; note: Note | null } | null>(null);

  useEffect(() => {
    if (id === 'new') return;
    let cancelled = false;
    getNote(db, Number(id), ACCESS).then((note) => !cancelled && setLoaded({ id, note }));
    return () => {
      cancelled = true;
    };
  }, [db, id]);

  if (id === 'new') return <NoteEditor key="new" initial={null} />;
  const current = loaded?.id === id ? loaded : null;
  if (!current?.note) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {current ? (
          <Text style={{ color: colors.textSecondary }}>This note no longer exists.</Text>
        ) : (
          <ActivityIndicator color={colors.textSecondary} />
        )}
      </View>
    );
  }
  return <NoteEditor key={current.note.id} initial={current.note} />;
}

type Draft = Pick<Note, 'title' | 'body' | 'isPrivate'>;

function NoteEditor({ initial }: { initial: Note | null }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const colors = useColors();
  const [draft, setDraft] = useState<Draft>({
    title: initial?.title ?? '',
    body: initial?.body ?? '',
    isPrivate: initial?.isPrivate ?? false,
  });
  const [status, setStatus] = useState<'saved' | 'saving' | 'failed' | null>(initial ? 'saved' : null);
  const unlocked = usePrivacyStore((s) => s.unlocked);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Saving works from refs, so the save that runs when leaving still sees the latest text.
  const noteId = useRef(initial?.id ?? null);
  const latest = useRef(draft);
  const dirty = useRef(false);
  const deleted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  /** Writes the latest text. Saves run one after another, so a new note is only created once. */
  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    queue.current = queue.current.then(async () => {
      if (!dirty.current || deleted.current) return;
      dirty.current = false;
      const next = latest.current;
      try {
        if (noteId.current === null) {
          // A new note that is still empty isn't worth keeping.
          if (!next.title.trim() && !next.body.trim()) return setStatus(null);
          noteId.current = (await createNote(db, next)).id;
        } else {
          await updateNote(db, noteId.current, next, ACCESS);
        }
        setStatus('saved');
        useNotesStore.getState().changed();
      } catch {
        dirty.current = true;
        setStatus('failed');
      }
    });
    return queue.current;
  }, [db]);

  // Save whatever is left when the editor closes.
  useEffect(() => () => void save(), [save]);

  const change = (changes: Partial<Draft>) => {
    latest.current = { ...latest.current, ...changes };
    dirty.current = true;
    setDraft(latest.current);
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, AUTOSAVE_MS);
  };

  /** Unlocks private notes. Cancelling does nothing; other failures are shown. */
  const tryUnlock = async (promptMessage?: string) => {
    setUnlockError(null);
    const result = await usePrivacyStore.getState().unlock(promptMessage);
    if (!result.unlocked && result.reason) setUnlockError(result.reason);
    return result.unlocked;
  };

  // Making a note private unlocks first (spec §10.1); otherwise it would lock itself away at once.
  const togglePrivate = async () => {
    const makePrivate = !latest.current.isPrivate;
    if (makePrivate && !(await tryUnlock('Unlock to make this note private'))) return;
    change({ isPrivate: makePrivate });
  };

  const remove = async () => {
    if (noteId.current !== null) {
      const title = noteTitle(latest.current);
      if (!(await confirm('Delete note?', `"${title}" will be deleted from this phone.`))) return;
      deleted.current = true;
      await queue.current;
      await deleteNote(db, noteId.current, ACCESS);
      useNotesStore.getState().changed();
    }
    goBack(router);
  };

  // Locked again while open (e.g. after Nova went to the background): hide the text until unlocked.
  if (draft.isPrivate && !unlocked) {
    return (
      <>
        <Stack.Screen options={{ headerRight: () => null }} />
        <View style={[styles.center, styles.lockedView, { backgroundColor: colors.background }]}>
          <Icon name="lock" size={32} color={colors.accent} />
          <Text style={[styles.lockedTitle, { color: colors.text }]}>This note is private</Text>
          <Text style={[styles.lockedBody, { color: colors.textSecondary }]}>Unlock with your fingerprint, face or screen lock to read it.</Text>
          {unlockError && <Text style={[styles.lockedBody, { color: colors.danger }]}>{unlockError}</Text>}
          <Button title="Unlock" icon="lockOpen" onPress={() => tryUnlock()} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <IconButton
                icon={draft.isPrivate ? 'lock' : 'lockOpen'}
                label={draft.isPrivate ? 'Make public' : 'Make private'}
                color={draft.isPrivate ? colors.accent : colors.textSecondary}
                onPress={togglePrivate}
              />
              <IconButton icon="delete" label="Delete note" color={colors.textSecondary} onPress={remove} />
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.screen, { backgroundColor: colors.background }]}
        behavior={process.env.EXPO_OS === 'web' ? undefined : 'padding'}>
        <TextInput
          value={draft.title}
          onChangeText={(title) => change({ title })}
          placeholder="Title"
          placeholderTextColor={colors.textSecondary}
          autoFocus={!initial}
          style={[styles.title, noWebOutline, { color: colors.text }]}
          accessibilityLabel="Title"
        />
        <View style={styles.meta}>
          {draft.isPrivate && (
            <View style={styles.metaItem}>
              <Icon name="lock" size={13} color={colors.accent} />
              <Text style={[styles.metaText, { color: colors.accent }]}>{"Private · Nova can't see this note"}</Text>
            </View>
          )}
          {initial?.createdBy === 'ai' && (
            <View style={styles.metaItem}>
              <Icon name="sparkles" size={13} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>Written by Nova</Text>
            </View>
          )}
          {status && (
            <Text style={[styles.metaText, { color: status === 'failed' ? colors.danger : colors.textSecondary }]}>
              {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : "Couldn't save"}
            </Text>
          )}
        </View>
        <TextInput
          value={draft.body}
          onChangeText={(body) => change({ body })}
          placeholder="Start writing…"
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[styles.body, noWebOutline, { color: colors.text }]}
          accessibilityLabel="Note"
        />
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lockedView: { gap: Spacing.md, padding: Spacing.xl },
  lockedTitle: { fontSize: 20, fontWeight: '700' },
  lockedBody: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  headerActions: { flexDirection: 'row' },
  title: { fontSize: 22, fontWeight: '700', paddingVertical: Spacing.sm },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.md, minHeight: 18, marginBottom: Spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  body: { flex: 1, fontSize: 16, lineHeight: 24, textAlignVertical: 'top', paddingBottom: Spacing.xl },
});
