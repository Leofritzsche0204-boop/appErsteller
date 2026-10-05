import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';

import { colors } from '../../components/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="rechner"
        options={{
          title: 'Rechner',
          tabBarIcon: ({ color, size }) => <Ionicons name="calculator-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="verlauf"
        options={{
          title: 'Verlauf',
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
