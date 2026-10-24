import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';

import { Radius, Spacing, useColors } from '@/theme';

import { Button } from './ui';

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  resolve: (confirmed: boolean) => void;
}

const useConfirmRequest = create<{ request: ConfirmRequest | null }>(() => ({ request: null }));

/**
 * Asks the user to confirm inside the app, for platforms whose own dialogs
 * can't be relied on: embedded browsers, like the dev preview's, block
 * window.confirm and it returns false without showing anything.
 */
export function askToConfirm(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    // A new question replaces one still open, which counts as a no.
    useConfirmRequest.getState().request?.resolve(false);
    useConfirmRequest.setState({ request: { title, message, confirmLabel, resolve } });
  });
}

/** Renders the open confirmation, if any. Mounted once, in the root layout. */
export function ConfirmDialog() {
  const colors = useColors();
  const request = useConfirmRequest((s) => s.request);

  const answer = (confirmed: boolean) => {
    request?.resolve(confirmed);
    useConfirmRequest.setState({ request: null });
  };

  return (
    <Modal visible={!!request} transparent animationType="fade" onRequestClose={() => answer(false)}>
      <Pressable style={styles.backdrop} onPress={() => answer(false)} accessibilityLabel="Cancel">
        {/* Taps on the card itself must not reach the backdrop. */}
        <Pressable style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]} accessibilityRole="alert">
          <Text style={[styles.title, { color: colors.text }]}>{request?.title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{request?.message}</Text>
          <View style={styles.buttons}>
            <View style={styles.button}>
              <Button title="Cancel" variant="secondary" onPress={() => answer(false)} />
            </View>
            <View style={styles.button}>
              <Button title={request?.confirmLabel ?? 'OK'} variant="danger" onPress={() => answer(true)} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  card: { width: '100%', maxWidth: 400, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.xl, gap: Spacing.md },
  title: { fontSize: 18, fontWeight: '700' },
  message: { fontSize: 15, lineHeight: 21 },
  buttons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  button: { flex: 1 },
});
