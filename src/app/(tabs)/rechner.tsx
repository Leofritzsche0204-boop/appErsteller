import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { budgetStatus, monthSummary } from '../../lib/stats';
import type { Category, ItemStatus } from '../../lib/items';
import { COOLDOWN_HOURS } from '../../lib/wishlist';
import { LIMITS, computeHourlyRates, hoursForPrice, workDaysForHours } from '../../lib/wage';
import { useApp } from '../../state/AppProvider';
import { useItems } from '../../state/ItemsProvider';
import { useReminders } from '../../state/RemindersProvider';
import { badgeMessage, useAchievements } from '../../state/useAchievements';

type Feedback = { tone: 'saved' | 'bought'; text: string };

export default function Calculator() {
  const { profile, fixedCostsTotal } = useApp();
  const { items, createItem } = useItems();
  const { streak, badgesUnlockedBy } = useAchievements();
  const { permission, prefs, requestPermission } = useReminders();
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

  // Monatsbudget: wie viel bleibt nach diesem Kauf?
  const budget = useMemo(
    () => budgetStatus(monthSummary(items).spentHours, profile?.monthlyBudgetHours ?? null),
    [items, profile?.monthlyBudgetHours],
  );
  const remainingAfter = budget && hours != null ? budget.remaining - hours : null;

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
      const badges = badgeMessage(badgesUnlockedBy([item, ...items]));
      setFeedback(
        status === 'skipped'
          ? { tone: 'saved', text: `💪 Stark! Du hast dir ${duration} Arbeit gespart.${badges}` }
          : status === 'wishlist'
            ? { tone: 'saved', text: `⏳ Auf der Wunschliste. In ${COOLDOWN_HOURS} Stunden fragen wir dich nochmal, ob du ${duration} Arbeit dafür ausgeben willst.` }
            : {
                tone: 'bought',
                text:
                  `Eingetragen: ${duration} Arbeit. Gönn es dir bewusst.` +
                  (streak.current > 0 ? ` Deine Sparserie von ${streak.current} Tagen startet neu.` : ''),
              },
      );
      setPriceText('');
      setTitle('');
      setCategory(null);
      // Beim ersten Wunsch fragen, ob wir nach der Bedenkzeit erinnern dürfen.
      if (status === 'wishlist' && prefs.cooldown && permission === 'undetermined') {
        requestPermission().catch(() => undefined);
      }
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
        <View style={styles.headerRight}>
          <Link href="/statistik" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sparserie: ${streak.current} Tage ohne Impulskauf`}
              style={styles.streakChip}
              hitSlop={6}
            >
              <Text style={styles.streakText}>🔥 {streak.current}</Text>
            </Pressable>
          </Link>
          <Link href="/einstellungen" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Einstellungen" hitSlop={10}>
              <Text style={styles.settings}>⚙️</Text>
            </Pressable>
          </Link>
        </View>
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
            {budget && remainingAfter != null ? (
              remainingAfter < 0 ? (
                <Text style={styles.budgetOver}>
                  ⚠️ Damit liegst du {formatDuration(-remainingAfter)} über deinem Monatsbudget.
                </Text>
              ) : (
                <Text style={styles.resultSub}>
                  Danach bleiben {formatDuration(remainingAfter)} von {formatDuration(budget.budget)} Budget.
                </Text>
              )
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
          <Button
            title={`⏳ Wunschliste (${COOLDOWN_HOURS} Std. warten)`}
            variant="secondary"
            onPress={() => onDecide('wishlist')}
            loading={saving === 'wishlist'}
            disabled={saving !== null}
          />
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  streakChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  result: { alignItems: 'center', paddingVertical: spacing.lg },
  resultLabel: { color: colors.textMuted, fontSize: 15 },
  resultValue: { color: colors.accent, fontSize: 44, fontWeight: '800' },
  resultSub: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  budgetOver: { color: colors.warning, fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: spacing.xs },
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
