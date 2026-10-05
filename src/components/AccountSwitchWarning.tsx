import { StyleSheet, Text } from 'react-native';

import { useApp } from '../state/AppProvider';
import { useItems } from '../state/ItemsProvider';
import { Card } from './Card';
import { colors } from './theme';

/** Warnt, wenn ein anonymes Konto mit Daten durch eine Anmeldung ersetzt würde. */
export function AccountSwitchWarning() {
  const { session, profile } = useApp();
  const { items } = useItems();
  const anonymous = session?.user.is_anonymous ?? true;
  const hasData = items.length > 0 || !!profile?.onboardedAt;
  if (!anonymous || !hasData) return null;
  return (
    <Card style={styles.card}>
      <Text style={styles.text}>
        ⚠️ Du nutzt gerade ein ungesichertes Konto. Wenn du dich mit einem anderen Konto anmeldest,
        sind die Daten auf diesem Handy danach nicht mehr erreichbar. Willst du sie behalten, sichere
        stattdessen dieses Konto in den Einstellungen.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: colors.warning },
  text: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
