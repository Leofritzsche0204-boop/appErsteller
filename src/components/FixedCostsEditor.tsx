import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { friendlyError } from '../lib/errors';
import { formatEuro, parseAmount } from '../lib/format';
import { LIMITS } from '../lib/wage';
import { useApp } from '../state/AppProvider';
import { Button } from './Button';
import { TextField } from './TextField';
import { colors, radius, spacing } from './theme';

const MAX_ENTRIES = 30;

/** Liste der Fixkosten mit Hinzufügen/Löschen. Speichert direkt in der Datenbank. */
export function FixedCostsEditor() {
  const { fixedCosts, fixedCostsTotal, addFixedCost, deleteFixedCost } = useApp();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const onAdd = async () => {
    const trimmed = name.trim();
    const value = parseAmount(amount);
    if (trimmed.length < 1 || trimmed.length > 40) {
      setError('Bitte einen Namen mit 1 bis 40 Zeichen eingeben, z. B. "Miete".');
      return;
    }
    if (value == null || value < LIMITS.fixedCost.min || value > LIMITS.fixedCost.max) {
      setError('Bitte einen gültigen Betrag pro Monat eingeben, z. B. 450.');
      return;
    }
    if (fixedCosts.length >= MAX_ENTRIES) {
      setError(`Maximal ${MAX_ENTRIES} Einträge möglich.`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addFixedCost(trimmed, Math.round(value * 100) / 100);
      setName('');
      setAmount('');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteFixedCost(id);
    } catch (e) {
      Alert.alert('Löschen fehlgeschlagen', friendlyError(e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View style={styles.wrapper}>
      {fixedCosts.length > 0 ? (
        <View style={styles.list}>
          {fixedCosts.map((c) => (
            <View key={c.id} style={styles.row}>
              <Text style={styles.name} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.amount}>{formatEuro(c.amountMonthly)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${c.name} löschen`}
                onPress={() => onDelete(c.id)}
                disabled={deletingId === c.id}
                hitSlop={10}
              >
                <Text style={styles.delete}>{deletingId === c.id ? '…' : '✕'}</Text>
              </Pressable>
            </View>
          ))}
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>Summe pro Monat</Text>
            <Text style={styles.totalAmount}>{formatEuro(fixedCostsTotal)}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>Noch keine Fixkosten eingetragen.</Text>
      )}

      <TextField
        label="Bezeichnung"
        placeholder="z. B. Miete"
        value={name}
        onChangeText={setName}
        maxLength={40}
        returnKeyType="next"
      />
      <TextField
        label="Betrag pro Monat"
        placeholder="z. B. 450"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        suffix="€"
        error={error}
      />
      <Button title="Fixkosten hinzufügen" variant="secondary" onPress={onAdd} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  list: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { flex: 1, color: colors.text, fontSize: 15 },
  amount: { color: colors.text, fontSize: 15, fontVariant: ['tabular-nums'] },
  delete: { color: colors.textMuted, fontSize: 16, paddingHorizontal: spacing.xs },
  totalRow: { borderBottomWidth: 0 },
  totalLabel: { flex: 1, color: colors.textMuted, fontSize: 14 },
  totalAmount: { color: colors.text, fontSize: 15, fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: 14 },
});
