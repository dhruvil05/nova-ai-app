import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { Suspense, useEffect, type ReactNode } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { migrate } from '@/db/migrate';
import { initReminders } from '@/services/reminders';
import { useProviderStore } from '@/store/providerStore';
import { Colors } from '@/theme';

export default function RootLayout() {
  useEffect(() => initReminders(), []);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, primary: colors.accent, background: colors.background, card: colors.background, text: colors.text, border: colors.border },
  };

  return (
    <ThemeProvider value={theme}>
      <Suspense fallback={<Loading color={colors.textSecondary} background={colors.background} />}>
        <SQLiteProvider databaseName="nova.db" onInit={migrate} useSuspense>
          <LoadProviders>
            <Stack screenOptions={{ headerShadowVisible: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="conversations" options={{ title: 'Chats' }} />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
              <Stack.Screen name="provider/[id]" options={{ title: 'Provider' }} />
              <Stack.Screen name="models" options={{ title: 'Choose model' }} />
            </Stack>
          </LoadProviders>
        </SQLiteProvider>
      </Suspense>
      {/* Used by confirm() on web; native confirmations use the system Alert. */}
      <ConfirmDialog />
    </ThemeProvider>
  );
}

function LoadProviders({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const load = useProviderStore((s) => s.load);
  useEffect(() => {
    load(db);
  }, [db, load]);
  return children;
}

function Loading({ color, background }: { color: string; background: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: background }}>
      <ActivityIndicator color={color} />
    </View>
  );
}
