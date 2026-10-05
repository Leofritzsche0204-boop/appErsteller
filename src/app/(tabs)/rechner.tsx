import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CategoryPicker } from '../../components/CategoryPicker';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { colors, spacing } from '../../components/theme';
import { friendlyError } from '../../lib/errors';
import { formatDuration, formatEuro, formatWorkDays, parseAmount } from '../../lib/format';
import { TITLE_MAX_LENGTH } from '../../lib/items';
import type { Category, ItemStatus } from '../../lib/items';
import { LIMITS, computeHourlyRates, hoursForPrice, workDaysForHours } from '../../lib/wage';
import { useApp } from '../../state/AppProvider';
import { useItems } from '../../state/ItemsProvider';

type Feedback = { tone: 'saved' | 'bought'; text: string };

export default function Calculator() {
  const { profile, fixedCostsTotal } = useApp();
  const { createItem } = useItems();
  const [priceText, setPriceText] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState<ItemStatus | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const rates = profile ? computeHourlyRates(profile, fixedCostsTotal) : null;
  const price = parseAmount(priceText);
  const priceError =
    priceText.trim() === ''
      ? null
      : price == null
        ? 'Bitte einen gültigen Preis eingeben, z. B. 89,99.'
        : price < LIMITS.price.min || price > LIMITS.price.max
          ? 'Dieser Preis liegt außerhalb des erlaubten Bereichs.'
          : null;
  const validPrice = price != null && !priceError ? price : null;

  // Mit Fixkosten zählt der "freie" Stundenlohn, sonst der normale.
  const rate = rates ? (rates.free ?? rates.base) : null;
  const hours = validPrice != null && rate ? hoursForPrice(validPrice, rate) : null;
  const days = hours != null ? workDaysForHours(hours, profile?.weeklyHours ?? null) : null;
  const baseHours = validPrice != null && rates?.free != null ? hoursForPrice(validPrice, rates.base) : null;

  const onPriceChange = (text: string) => {
    setPriceText(text);
    setFeedback(null);
    setSaveError(null);
  };

  const onDecide = async (status: ItemStatus) => {
    if (validPrice == null || saving) return;
    setSaving(status);
    setSaveError(null);
    try {
      const item = await createItem({ price: validPrice, status, title, category });
      const duration = formatDuration(item.hours);
      setFeedback(
        status === 'skipped'
          ? { tone: 'saved', text: `💪 Stark! Du hast dir ${duration} Arbeit gespart.` }
          : { tone: 'bought', text: `Eingetragen: ${duration} Arbeit. Gönn es dir bewusst.` },
      );
      setPriceText('');
      setTitle('');
      setCategory(null);
    } catch (e) {
      setSaveError(friendlyError(e));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Time is Money</Text>
        <Link href="/einstellungen" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Einstellungen" hitSlop={10}>
            <Text style={styles.settings}>⚙️</Text>
          </Pressable>
        </Link>
      </View>

      <TextField
        label="Was kostet es?"
        placeholder="0,00"
        value={priceText}
        onChangeText={onPriceChange}
        keyboardType="decimal-pad"
        suffix="€"
        error={priceError}
        maxLength={15}
      />

      {feedback ? (
        <Card style={feedback.tone === 'saved' ? styles.feedbackSaved : undefined}>
          <Text style={styles.feedbackText}>{feedback.text}</Text>
        </Card>
      ) : null}

      {!rate ? (
        <Card>
          <Text style={styles.warning}>Dein Lohn ist noch nicht vollständig eingerichtet.</Text>
          <Link href="/einstellungen" style={styles.link}>
            Jetzt einrichten →
          </Link>
        </Card>
      ) : hours != null && validPrice != null ? (
        <>
          <Card style={styles.result}>
            <Text style={styles.resultLabel}>Dafür musst du arbeiten:</Text>
            <Text style={styles.resultValue} adjustsFontSizeToFit numberOfLines={1}>
              {formatDuration(hours)}
            </Text>
            {days != null && days >= 1 ? (
              <Text style={styles.resultSub}>≈ {formatWorkDays(days)}</Text>
            ) : null}
            {baseHours != null ? (
              <Text style={styles.resultSub}>Ohne Fixkosten-Abzug: {formatDuration(baseHours)}</Text>
            ) : null}
          </Card>

          <TextField
            label="Was ist es? (optional)"
            placeholder="z. B. Sneaker"
            value={title}
            onChangeText={setTitle}
            maxLength={TITLE_MAX_LENGTH}
          />
          <CategoryPicker value={category} onChange={setCategory} />

          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          <View style={styles.decision}>
            <View style={styles.decisionButton}>
              <Button
                title="Nicht gekauft 💪"
                onPress={() => onDecide('skipped')}
                loading={saving === 'skipped'}
                disabled={saving !== null}
              />
            </View>
            <View style={styles.decisionButton}>
              <Button
                title="Gekauft"
                variant="secondary"
                onPress={() => onDecide('bought')}
                loading={saving === 'bought'}
                disabled={saving !== null}
              />
            </View>
          </View>
        </>
      ) : !feedback ? (
        <Text style={styles.placeholder}>
          Tippe einen Preis ein und sieh sofort, wie lange du dafür arbeiten gehst.
        </Text>
      ) : null}

      {rate ? (
        <Text style={styles.basis}>
          Berechnet mit {formatEuro(rate)} pro Stunde
          {rates?.free != null ? ' (nach Fixkosten)' : ''}.
          {rates?.fixedCostsExceedIncome ? ' Achtung: Deine Fixkosten übersteigen dein Einkommen.' : ''}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  settings: { fontSize: 24 },
  result: { alignItems: 'center', paddingVertical: spacing.lg },
  resultLabel: { color: colors.textMuted, fontSize: 15 },
  resultValue: { color: colors.accent, fontSize: 44, fontWeight: '800' },
  resultSub: { color: colors.textMuted, fontSize: 15 },
  decision: { flexDirection: 'row', gap: spacing.sm },
  decisionButton: { flex: 1 },
  feedbackSaved: { borderColor: colors.accent },
  feedbackText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  placeholder: { color: colors.textMuted, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  basis: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  warning: { color: colors.warning, fontSize: 15 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 14 },
});
