import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { friendlyError } from '../lib/errors';
import { formatInput, parseAmount } from '../lib/format';
import { LIMITS } from '../lib/wage';
import { useApp } from '../state/AppProvider';
import { Button } from './Button';
import { TextField } from './TextField';
import { colors, spacing } from './theme';

/** Monatsbudget in Arbeitsstunden festlegen. Leeres Feld = kein Budget. */
export function BudgetForm() {
  const { profile, updateProfile } = useApp();
  const [value, setValue] = useState(() => formatInput(profile?.monthlyBudgetHours, 1));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSave = async () => {
    let hours: number | null = null;
    if (value.trim() !== '') {
      const parsed = parseAmount(value);
      if (parsed == null || parsed < LIMITS.budgetHours.min || parsed > LIMITS.budgetHours.max) {
        setError(`Bitte eine Zahl von ${LIMITS.budgetHours.min} bis ${LIMITS.budgetHours.max} eingeben – oder leer lassen.`);
        return;
      }
      hours = Math.round(parsed * 100) / 100;
    }
    setError(null);
    setSaving(true);
    try {
      await updateProfile({ monthlyBudgetHours: hours });
      setSaved(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <TextField
        label="Arbeitsstunden pro Monat für Käufe"
        placeholder="z. B. 20"
        value={value}
        onChangeText={(t) => {
          setValue(t);
          setSaved(false);
        }}
        keyboardType="decimal-pad"
        suffix="Std."
        error={error}
        hint="Leer lassen, wenn du kein Budget möchtest. Ab 80 % warnt dich die App."
      />
      {saved ? <Text style={styles.saved}>Gespeichert ✓</Text> : null}
      <Button title="Budget speichern" variant="secondary" onPress={onSave} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  saved: { color: colors.accent, fontSize: 14 },
});
