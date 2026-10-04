import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// Phase 0: Startbildschirm zum Testen, ob die App auf dem Handy läuft.
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Time is Money</Text>
      <Text style={styles.subtitle}>Was kostet dich das wirklich?</Text>
      <Text style={styles.hint}>Phase 0 läuft ✅</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#F5F7FA',
    fontSize: 34,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9AA4B2',
    fontSize: 16,
    marginTop: 8,
  },
  hint: {
    color: '#22C55E',
    fontSize: 14,
    marginTop: 32,
  },
});
