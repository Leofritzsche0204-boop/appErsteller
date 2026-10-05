import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';

import { colors } from '../../components/theme';
import { useNow } from '../../lib/useNow';
import { isCooldownOver } from '../../lib/wishlist';
import { useFriends } from '../../state/FriendsProvider';
import { useItems } from '../../state/ItemsProvider';

export default function TabsLayout() {
  const { items } = useItems();
  const { incomingCount } = useFriends();
  const now = useNow(60000);
  // Anzahl der Wünsche, deren Bedenkzeit abgelaufen ist → Zahl am Tab
  const readyCount = items.filter((i) => i.status === 'wishlist' && isCooldownOver(i, now)).length;

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
        name="wunschliste"
        options={{
          title: 'Wunschliste',
          tabBarBadge: readyCount > 0 ? readyCount : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="hourglass-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ziele"
        options={{
          title: 'Ziele',
          tabBarIcon: ({ color, size }) => <Ionicons name="flag-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="freunde"
        options={{
          title: 'Freunde',
          tabBarBadge: incomingCount > 0 ? incomingCount : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="statistik"
        options={{
          title: 'Statistik',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
