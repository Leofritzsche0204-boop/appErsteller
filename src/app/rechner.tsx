import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors, spacing } from '../components/theme';
import { formatDuration, formatEuro, formatWorkDays, parseAmount } from '../lib/format';
import { LIMITS, computeHourlyRates, hoursForPrice, workDaysForHours } from '../lib/wage';
import { useApp } from '../state/AppProvider';

export default function Calculator() {
  const { profile, fixedCostsTotal } = useApp();
  const [priceText, setPriceText] = useState('');

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

  return (
    <Screen>
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
        onChangeText={setPriceText}
        keyboardType="decimal-pad"
        suffix="€"
        error={priceError}
        autoFocus
        maxLength={15}
      />

      {!rate ? (
        <Card>
          <Text style={styles.warning}>
            Dein Lohn ist noch nicht vollständig eingerichtet.
          </Text>
          <Link href="/einstellungen" style={styles.link}>
            Jetzt einrichten →
          </Link>
        </Card>
      ) : hours != null && validPrice != null ? (
        <Card style={styles.result}>
          <Text style={styles.resultLabel}>Dafür musst du arbeiten:</Text>
          <Text style={styles.resultValue} adjustsFontSizeToFit numberOfLines={1}>
            {formatDuration(hours)}
          </Text>
          {days != null && days >= 1 ? (
            <Text style={styles.resultSub}>≈ {formatWorkDays(days)}</Text>
          ) : null}
          {baseHours != null ? (
            <Text style={styles.resultSub}>
              Ohne Fixkosten-Abzug: {formatDuration(baseHours)}
            </Text>
          ) : null}
        </Card>
      ) : (
        <Text style={styles.placeholder}>
          Tippe einen Preis ein und sieh sofort, wie lange du dafür arbeiten gehst.
        </Text>
      )}

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
  placeholder: { color: colors.textMuted, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  basis: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  warning: { color: colors.warning, fontSize: 15 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '700' },
});
