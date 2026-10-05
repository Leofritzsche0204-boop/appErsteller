import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';
import { TextField } from '../components/TextField';
import { colors, radius, spacing } from '../components/theme';
import { friendlyError } from '../lib/errors';
import { formatDuration, parseAmount } from '../lib/format';
import { GOAL_EMOJIS, GOAL_NAME_MAX_LENGTH, SHARED_GOAL_HOURS } from '../lib/goals';
import { computeHourlyRates, hoursForPrice } from '../lib/wage';
import { useApp } from '../state/AppProvider';
import { useGoals } from '../state/GoalsProvider';

const MAX_PRICE = 10000000;
type Kind = 'private' | 'shared';
const KINDS: { value: Kind; label: string }[] = [
  { value: 'private', label: 'Allein' },
  { value: 'shared', label: 'Mit Freunden' },
];

export default function NewGoal() {
  const { profile, fixedCostsTotal, session } = useApp();
  const { createGoal } = useGoals();
  const [kind, setKind] = useState<Kind>('private');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string | null>(GOAL_EMOJIS[0]);
  const [amountText, setAmountText] = useState('');
  const [errors, setErrors] = useState<{ name?: string; amount?: string; save?: string }>({});
  const [saving, setSaving] = useState(false);

  const canShare = session?.user.is_anonymous === false && !!profile?.username;
  const rates = profile ? computeHourlyRates(profile, fixedCostsTotal) : null;
  const rate = rates ? (rates.free ?? rates.base) : null;
  const amount = parseAmount(amountText);
  const previewHours =
    kind === 'private' && amount != null && amount >= 1 && amount <= MAX_PRICE && rate ? hoursForPrice(amount, rate) : null;

  const onSave = async () => {
    const next: typeof errors = {};
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > GOAL_NAME_MAX_LENGTH) next.name = 'Bitte gib deinem Ziel einen Namen.';
    if (kind === 'private' && (amount == null || amount < 1 || amount > MAX_PRICE)) {
      next.amount = 'Bitte einen Betrag ab 1 € eingeben, z. B. 900.';
    }
    if (kind === 'shared' && (amount == null || amount < SHARED_GOAL_HOURS.min || amount > SHARED_GOAL_HOURS.max)) {
      next.amount = `Bitte ${SHARED_GOAL_HOURS.min} bis ${SHARED_GOAL_HOURS.max.toLocaleString('de-DE')} Stunden eingeben.`;
    }
    setErrors(next);
    if (next.name || next.amount || amount == null) return;

    setSaving(true);
    try {
      const value = Math.round(amount * 100) / 100;
      await createGoal(
        kind === 'private'
          ? { kind, name: trimmed, emoji, targetPrice: value }
          : { kind, name: trimmed, emoji, targetHours: value },
      );
      router.back();
    } catch (e) {
      setErrors({ save: friendlyError(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Segmented
        options={KINDS}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setAmountText('');
          setErrors({});
        }}
      />

      {kind === 'shared' && !canShare ? (
        <Card>
          <Text style={styles.body}>
            Für gemeinsame Ziele brauchst du ein gesichertes Konto und einen Benutzernamen (Tab „Freunde“).
          </Text>
        </Card>
      ) : (
        <>
          <Text style={styles.intro}>
            {kind === 'private'
              ? 'Wofür sparst du? Deine gesparten Stunden kannst du danach diesem Ziel zuordnen.'
              : 'Spart zusammen für etwas! Jeder gibt eigene gesparte Stunden dazu. Gemessen wird in Stunden, damit niemand den Lohn der anderen erfährt.'}
          </Text>

          <View style={styles.emojis} accessibilityRole="radiogroup">
            {GOAL_EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                accessibilityRole="radio"
                accessibilityState={{ selected: emoji === e }}
                style={[styles.emoji, emoji === e && styles.emojiSelected]}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <TextField
            label="Name"
            placeholder={kind === 'private' ? 'z. B. Urlaub' : 'z. B. Festival-Trip'}
            value={name}
            onChangeText={setName}
            maxLength={GOAL_NAME_MAX_LENGTH}
            error={errors.name}
          />
          <TextField
            label={kind === 'private' ? 'Was kostet dein Ziel?' : 'Wie viele Stunden wollt ihr zusammen sparen?'}
            placeholder={kind === 'private' ? 'z. B. 900' : 'z. B. 50'}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            suffix={kind === 'private' ? '€' : 'Std.'}
            error={errors.amount}
          />

          {previewHours != null ? (
            <Card style={styles.preview}>
              <Text style={styles.previewLabel}>Das sind</Text>
              <Text style={styles.previewValue}>{formatDuration(previewHours)} Arbeit</Text>
            </Card>
          ) : null}

          {kind === 'shared' ? (
            <Text style={styles.muted}>Nach dem Anlegen kannst du bis zu 9 Freunde einladen.</Text>
          ) : null}

          {errors.save ? <Text style={styles.error}>{errors.save}</Text> : null}
          <Button title="Ziel anlegen" onPress={onSave} loading={saving} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.textMuted, fontSize: 13 },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emoji: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiSelected: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
  emojiText: { fontSize: 24 },
  preview: { alignItems: 'center' },
  previewLabel: { color: colors.textMuted, fontSize: 14 },
  previewValue: { color: colors.accent, fontSize: 26, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 14 },
});
