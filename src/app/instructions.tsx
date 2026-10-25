import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Field } from '@/components/ui';
import { getSetting, setSetting } from '@/db/settingsRepo';
import { goBack } from '@/lib/navigation';
import { Spacing, useColors } from '@/theme';

/** Both fields go into every request, so they stay short. */
const MAX_LENGTH = 1000;

/** Custom instructions: what Nova should know about the user, and how it should reply. */
export default function InstructionsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const colors = useColors();
  // null until the saved text has loaded, so typing can't be overwritten by it.
  const [form, setForm] = useState<{ aboutUser: string; replyStyle: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getSetting(db, 'about_user'), getSetting(db, 'reply_style')]).then(([aboutUser, replyStyle]) =>
      setForm({ aboutUser: aboutUser ?? '', replyStyle: replyStyle ?? '' })
    );
  }, [db]);

  if (!form) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }

  const save = async () => {
    setSaving(true);
    await setSetting(db, 'about_user', form.aboutUser.trim() || null);
    await setSetting(db, 'reply_style', form.replyStyle.trim() || null);
    goBack(router);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <Text style={[styles.intro, { color: colors.textSecondary }]}>
        Nova reads these with every message, in every chat. They are sent to your AI provider along with your messages.
      </Text>
      <Field
        label="What should Nova know about you?"
        value={form.aboutUser}
        onChangeText={(aboutUser) => setForm({ ...form, aboutUser })}
        placeholder="e.g. I live in Ahmedabad and work as a software developer. I'm vegetarian."
        multiline
        maxLength={MAX_LENGTH}
        autoCapitalize="sentences"
        autoCorrect
        hint={`${form.aboutUser.length} / ${MAX_LENGTH}`}
      />
      <Field
        label="How should Nova reply?"
        value={form.replyStyle}
        onChangeText={(replyStyle) => setForm({ ...form, replyStyle })}
        placeholder="e.g. Keep answers short. Use bullet points for steps. Reply in Gujarati when I write in Gujarati."
        multiline
        maxLength={MAX_LENGTH}
        autoCapitalize="sentences"
        autoCorrect
        hint={`${form.replyStyle.length} / ${MAX_LENGTH}`}
      />
      <Button title="Save" onPress={save} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xl * 2 },
  intro: { fontSize: 14, lineHeight: 20, marginHorizontal: Spacing.xs },
});
