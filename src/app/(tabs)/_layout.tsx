import { Tabs } from 'expo-router';

import { Icon } from '@/components/Icon';
import { useColors } from '@/theme';

// Notes, Music and Files tabs join the AI tab in later phases.
export default function TabLayout() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarHideOnKeyboard: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'AI', tabBarIcon: ({ color }) => <Icon name="sparkles" size={24} color={String(color)} /> }}
      />
    </Tabs>
  );
}
