import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors, radius, spacing } from '../components/theme';
import { friendlyError } from '../lib/errors';
import { formatDuration, parseAmount } from '../lib/format';
import { GOAL_EMOJIS, GOAL_NAME_MAX_LENGTH } from '../lib/goals';
import { computeHourlyRates, hoursForPrice } from '../lib/wage';
import { useApp } from '../state/AppProvider';
import { useGoals } from '../state/GoalsProvider';

const MAX_PRICE = 10000000;

export default function NewGoal() {
  const { profile, fixedCostsTotal } = useApp();
  const { createGoal } = useGoals();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string | null>(GOAL_EMOJIS[0]);
  const [priceText, setPriceText] = useState('');
  const [errors, setErrors] = useState<{ name?: string; price?: string; save?: string }>({});
  const [saving, setSaving] = useState(false);

  const rates = profile ? computeHourlyRates(profile, fixedCostsTotal) : null;
  const rate = rates ? (rates.free ?? rates.base) : null;
  const price = parseAmount(priceText);
  const previewHours = price != null && price >= 1 && price <= MAX_PRICE && rate ? hoursForPrice(price, rate) : null;

  const onSave = async () => {
    const next: typeof errors = {};
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > GOAL_NAME_MAX_LENGTH) next.name = 'Bitte gib deinem Ziel einen Namen.';
    if (price == null || price < 1 || price > MAX_PRICE) next.price = 'Bitte einen Betrag ab 1 € eingeben, z. B. 900.';
    setErrors(next);
    if (next.name || next.price || price == null) return;

    setSaving(true);
    try {
      await createGoal({ name: trimmed, emoji, targetPrice: Math.round(price * 100) / 100 });
      router.back();
    } catch (e) {
      setErrors({ save: friendlyError(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Text style={styles.intro}>
        Wofür sparst du? Deine gesparten Stunden kannst du danach diesem Ziel zuordnen.
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
        placeholder="z. B. Urlaub"
        value={name}
        onChangeText={setName}
        maxLength={GOAL_NAME_MAX_LENGTH}
        error={errors.name}
      />
      <TextField
        label="Was kostet dein Ziel?"
        placeholder="z. B. 900"
        value={priceText}
        onChangeText={setPriceText}
        keyboardType="decimal-pad"
        suffix="€"
        error={errors.price}
      />

      {previewHours != null ? (
        <Card style={styles.preview}>
          <Text style={styles.previewLabel}>Das sind</Text>
          <Text style={styles.previewValue}>{formatDuration(previewHours)} Arbeit</Text>
        </Card>
      ) : null}

      {errors.save ? <Text style={styles.error}>{errors.save}</Text> : null}
      <Button title="Ziel anlegen" onPress={onSave} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
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
