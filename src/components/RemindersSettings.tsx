import * as Linking from 'expo-linking';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { sendTestReminder } from '../lib/notifications';
import type { ReminderPrefs } from '../lib/reminderPlan';
import { useReminders } from '../state/RemindersProvider';
import { Button } from './Button';
import { colors, spacing } from './theme';

const ROWS: { key: keyof ReminderPrefs; title: string; text: string }[] = [
  { key: 'cooldown', title: '⏰ Bedenkzeit vorbei', text: 'Erinnerung, wenn ein Wunsch 24 Std. auf der Wunschliste lag' },
  { key: 'weekly', title: '📊 Wochenrückblick', text: 'Jeden Sonntag um 19 Uhr' },
  { key: 'budget', title: '⚠️ Budget-Warnung', text: 'Bei 80 % und beim Überschreiten deines Monatsbudgets' },
];

export function RemindersSettings() {
  const { prefs, permission, setPref, requestPermission } = useReminders();

  const onTest = async () => {
    if (await requestPermission()) await sendTestReminder();
  };

  return (
    <View style={styles.wrapper}>
      {permission === 'denied' ? (
        <View style={styles.denied}>
          <Text style={styles.deniedText}>
            Benachrichtigungen sind für diese App ausgeschaltet. Du kannst sie in den Einstellungen
            deines Handys erlauben.
          </Text>
          <Button title="Handy-Einstellungen öffnen" variant="secondary" onPress={() => Linking.openSettings()} />
        </View>
      ) : null}
      {ROWS.map((row) => (
        <View key={row.key} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.title}>{row.title}</Text>
            <Text style={styles.text}>{row.text}</Text>
          </View>
          <Switch
            value={prefs[row.key] && permission !== 'denied'}
            onValueChange={(v) => {
              setPref(row.key, v).catch(() => undefined);
            }}
            disabled={permission === 'denied'}
            trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
            accessibilityLabel={row.title}
          />
        </View>
      ))}
      {__DEV__ ? (
        <Button
          title="🧪 Test-Erinnerung in 5 Sek. (nur Entwicklung)"
          variant="secondary"
          onPress={() => {
            onTest().catch(() => undefined);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  denied: { gap: spacing.sm },
  deniedText: { color: colors.warning, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  text: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});
