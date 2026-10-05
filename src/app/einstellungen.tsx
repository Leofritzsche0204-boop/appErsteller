import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';

import { BudgetForm } from '../components/BudgetForm';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { RemindersSettings } from '../components/RemindersSettings';
import { Screen } from '../components/Screen';
import { WageForm } from '../components/WageForm';
import { colors, spacing } from '../components/theme';
import { deleteMyAccount, exportMyData, signOut } from '../lib/account';
import { friendlyError } from '../lib/errors';
import { useRestartApp } from '../lib/useSwitchAccount';
import { useApp } from '../state/AppProvider';

export default function Settings() {
  const { session } = useApp();
  const restart = useRestartApp();
  const [busy, setBusy] = useState<'export' | 'delete' | 'signout' | null>(null);
  const isAnonymous = session?.user.is_anonymous ?? true;
  const pendingEmail = session?.user.new_email ?? null;

  const onExport = async () => {
    setBusy('export');
    try {
      const json = await exportMyData();
      await Share.share({ title: 'Time is Money – meine Daten', message: json });
    } catch (e) {
      Alert.alert('Export fehlgeschlagen', friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const onSignOut = () => {
    Alert.alert('Abmelden?', 'Du kannst dich jederzeit mit E-Mail und Passwort wieder anmelden.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Abmelden',
        onPress: async () => {
          setBusy('signout');
          try {
            await signOut();
            restart();
          } catch (e) {
            Alert.alert('Abmelden fehlgeschlagen', friendlyError(e));
            setBusy(null);
          }
        },
      },
    ]);
  };

  const onDelete = () => {
    Alert.alert(
      'Konto wirklich löschen?',
      'Alle deine Daten – Lohn, Einträge, Wunschliste, Ziele – werden endgültig gelöscht. Das kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Weiter',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Letzte Bestätigung', 'Konto und alle Daten jetzt endgültig löschen?', [
              { text: 'Abbrechen', style: 'cancel' },
              {
                text: 'Endgültig löschen',
                style: 'destructive',
                onPress: async () => {
                  setBusy('delete');
                  try {
                    await deleteMyAccount();
                    restart();
                  } catch (e) {
                    Alert.alert('Löschen fehlgeschlagen', friendlyError(e));
                    setBusy(null);
                  }
                },
              },
            ]),
        },
      ],
    );
  };

  return (
    <Screen edges={['bottom']}>
      <Text style={styles.section}>Lohn & Fixkosten</Text>
      <WageForm
        submitLabel="Speichern"
        onSaved={() => (router.canGoBack() ? router.back() : router.replace('/rechner'))}
      />

      <Text style={styles.section}>Monatsbudget</Text>
      <Card>
        <BudgetForm />
      </Card>

      <Text style={styles.section}>Erinnerungen</Text>
      <Card>
        <RemindersSettings />
      </Card>

      <Text style={styles.section}>Konto</Text>
      <Card>
        {isAnonymous ? (
          <View style={styles.stack}>
            <Text style={styles.body}>
              {pendingEmail
                ? `Fast geschafft: Bestätige noch den Code, den wir an ${pendingEmail} geschickt haben.`
                : '⚠️ Dein Konto ist noch nicht gesichert. Deine Daten hängen an diesem Handy und gehen bei einer Neuinstallation verloren.'}
            </Text>
            <Button
              title={pendingEmail ? 'Weiter mit dem Code' : '🔒 Konto sichern'}
              onPress={() => router.push('/konto/sichern')}
            />
            <Link href="/konto/anmelden" style={styles.link}>
              Ich habe schon ein Konto – anmelden
            </Link>
          </View>
        ) : (
          <View style={styles.stack}>
            <Text style={styles.body}>🔒 Angemeldet als {session?.user.email ?? 'Nutzer'}</Text>
            <Button title="Abmelden" variant="secondary" onPress={onSignOut} loading={busy === 'signout'} />
          </View>
        )}
      </Card>

      <Text style={styles.section}>Deine Daten</Text>
      <Card>
        <View style={styles.stack}>
          <Text style={styles.muted}>
            Deine Daten liegen verschlüsselt übertragen auf Servern in der EU (Frankfurt) und sind nur
            für dich sichtbar.
          </Text>
          <Button title="Daten exportieren" variant="secondary" onPress={onExport} loading={busy === 'export'} />
          <Button title="Konto löschen" variant="danger" onPress={onDelete} loading={busy === 'delete'} />
        </View>
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
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  stack: { gap: spacing.md },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 4 },
});
