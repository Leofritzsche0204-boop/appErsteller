import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { WageForm } from '../components/WageForm';
import { colors, spacing } from '../components/theme';
import { useApp } from '../state/AppProvider';

export default function Settings() {
  const { session } = useApp();
  const isAnonymous = session?.user.is_anonymous ?? true;

  return (
    <Screen edges={['bottom']}>
      <Text style={styles.section}>Lohn & Fixkosten</Text>
      <WageForm
        submitLabel="Speichern"
        onSaved={() => (router.canGoBack() ? router.back() : router.replace('/rechner'))}
      />

      <Text style={styles.section}>Konto</Text>
      <Card>
        <Text style={styles.body}>
          {isAnonymous
            ? 'Du nutzt die App ohne Konto. Deine Daten hängen an diesem Gerät. Bald kannst du hier dein Konto mit E-Mail, Google oder Apple sichern.'
            : `Angemeldet als ${session?.user.email ?? 'Nutzer'}.`}
        </Text>
      </Card>

      <Text style={styles.section}>Hilfe</Text>
      <Card>
        <Text style={styles.body}>
          Hast du das Gefühl, dein Kaufverhalten nicht mehr im Griff zu haben, oder machen dir
          Schulden Sorgen? Du bist nicht allein, und es gibt kostenlose Hilfe:
        </Text>
        <Text style={styles.body}>
          • Schuldnerberatung: z. B. bei der Verbraucherzentrale, Caritas oder Diakonie in deiner
          Stadt{'\n'}• Kaufsucht: Suchtberatungsstellen vor Ort, auch dein Hausarzt kann dich
          weitervermitteln{'\n'}• Wenn es dir seelisch schlecht geht: TelefonSeelsorge, rund um die
          Uhr und anonym, 0800 111 0 111
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
});
