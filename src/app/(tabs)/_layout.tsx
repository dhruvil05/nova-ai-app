import { Tabs } from 'expo-router';

import { Icon } from '@/components/Icon';
import { useColors } from '@/theme';

// Music and Files tabs join in later phases.
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
      <Tabs.Screen
        name="notes"
        options={{ title: 'Notes', tabBarIcon: ({ color }) => <Icon name="notes" size={24} color={String(color)} /> }}
      />
    </Tabs>
  );
}
