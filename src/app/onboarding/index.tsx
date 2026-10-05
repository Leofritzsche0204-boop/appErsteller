import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Checkbox } from '../../components/Checkbox';
import { Screen } from '../../components/Screen';
import { colors, spacing } from '../../components/theme';
import { friendlyError } from '../../lib/errors';
import { useApp } from '../../state/AppProvider';

const POINTS = [
  {
    icon: '⏱️',
    title: 'Preise in Arbeitszeit',
    text: 'Sneaker für 120 €? Bei 15 € pro Stunde sind das 8 Stunden deines Lebens.',
  },
  {
    icon: '🧠',
    title: 'Bewusster entscheiden',
    text: 'Bevor du kaufst, siehst du, wie lange du dafür arbeiten gehst.',
  },
  {
    icon: '🏆',
    title: 'Sparen mit Spaß',
    text: 'Bald: Sparziele, Abzeichen und Challenges mit Freunden.',
  },
];

export default function Welcome() {
  const { profile, updateProfile } = useApp();
  const [ageConfirmed, setAgeConfirmed] = useState(!!profile?.ageConfirmedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContinue = async () => {
    if (!ageConfirmed) return;
    setSaving(true);
    setError(null);
    try {
      if (!profile?.ageConfirmedAt) {
        await updateProfile({ ageConfirmedAt: new Date().toISOString() });
      }
      router.push('/onboarding/lohn');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Checkbox
            checked={ageConfirmed}
            onChange={setAgeConfirmed}
            label="Ich bin mindestens 16 Jahre alt."
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Los geht's" onPress={onContinue} disabled={!ageConfirmed} loading={saving} />
          <Link href="/konto/anmelden" style={styles.login}>
            Ich habe schon ein Konto – anmelden
          </Link>
        </View>
      }
    >
      <View style={styles.hero}>
        <Text style={styles.title}>Time is Money</Text>
        <Text style={styles.subtitle}>Was kostet dich das wirklich?</Text>
      </View>
      {POINTS.map((p) => (
        <Card key={p.title} style={styles.point}>
          <Text style={styles.icon}>{p.icon}</Text>
          <View style={styles.pointText}>
            <Text style={styles.pointTitle}>{p.title}</Text>
            <Text style={styles.pointBody}>{p.text}</Text>
          </View>
        </Card>
      ))}
      <Text style={styles.note}>
        Du kannst sofort loslegen, ohne Konto. Deine Daten werden sicher auf Servern in der EU
        gespeichert und sind nur für dich sichtbar.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingVertical: spacing.lg, gap: spacing.sm },
  title: { color: colors.text, fontSize: 36, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 18 },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  icon: { fontSize: 28 },
  pointText: { flex: 1, gap: spacing.xs },
  pointTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  pointBody: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  footer: { gap: spacing.md },
  error: { color: colors.danger, fontSize: 14 },
  login: { color: colors.accent, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 4 },
});
