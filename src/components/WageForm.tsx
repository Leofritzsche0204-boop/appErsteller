import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { friendlyError } from '../lib/errors';
import { formatEuro, formatInput } from '../lib/format';
import { computeHourlyRates } from '../lib/wage';
import type { WageMode } from '../lib/wage';
import { toProfileUpdate, validateWageForm } from '../lib/wageForm';
import type { WageFormErrors, WageFormInput } from '../lib/wageForm';
import { useApp } from '../state/AppProvider';
import { Button } from './Button';
import { Card } from './Card';
import { Checkbox } from './Checkbox';
import { FixedCostsEditor } from './FixedCostsEditor';
import { Segmented } from './Segmented';
import { TextField } from './TextField';
import { colors, spacing } from './theme';

type Props = {
  submitLabel: string;
  /** Wird nach erfolgreichem Speichern aufgerufen. */
  onSaved: () => void;
  /** Zusätzliche Felder beim Speichern, z. B. "Onboarding abgeschlossen". */
  extraUpdate?: { onboardedAt?: string };
};

const MODE_OPTIONS: { value: WageMode; label: string }[] = [
  { value: 'hourly', label: 'Stundenlohn' },
  { value: 'monthly', label: 'Monatsgehalt' },
];

/** Formular für Lohn, Wochenstunden und Fixkosten – im Onboarding und in den Einstellungen. */
export function WageForm({ submitLabel, onSaved, extraUpdate }: Props) {
  const { profile, fixedCostsTotal, updateProfile } = useApp();
  const [input, setInput] = useState<WageFormInput>(() => ({
    wageMode: profile?.wageMode ?? 'hourly',
    hourlyWage: formatInput(profile?.hourlyWage),
    monthlyNet: formatInput(profile?.monthlyNet),
    weeklyHours: formatInput(profile?.weeklyHours),
    useFixedCosts: profile?.useFixedCosts ?? false,
  }));
  const [errors, setErrors] = useState<WageFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof WageFormInput>(key: K, value: WageFormInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // Live-Vorschau des Stundenlohns, sobald die Eingaben gültig sind.
  const preview = useMemo(() => {
    const result = validateWageForm(input);
    if (!result.ok) return null;
    return computeHourlyRates(result.values, fixedCostsTotal);
  }, [input, fixedCostsTotal]);

  const onSubmit = async () => {
    const result = validateWageForm(input);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await updateProfile({ ...toProfileUpdate(result.values), ...extraUpdate });
      onSaved();
    } catch (e) {
      setSaveError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const weeklyHoursField = (
    <TextField
      label="Arbeitsstunden pro Woche"
      placeholder="z. B. 40"
      value={input.weeklyHours}
      onChangeText={(t) => set('weeklyHours', t)}
      keyboardType="decimal-pad"
      suffix="Std."
      error={errors.weeklyHours}
      hint={
        input.wageMode === 'hourly'
          ? 'Nötig für Fixkosten und die Anzeige in Arbeitstagen.'
          : undefined
      }
    />
  );

  return (
    <View style={styles.wrapper}>
      <Segmented options={MODE_OPTIONS} value={input.wageMode} onChange={(v) => set('wageMode', v)} />

      {input.wageMode === 'hourly' ? (
        <>
          <TextField
            label="Netto-Stundenlohn"
            placeholder="z. B. 14,50"
            value={input.hourlyWage}
            onChangeText={(t) => set('hourlyWage', t)}
            keyboardType="decimal-pad"
            suffix="€"
            error={errors.hourlyWage}
            hint="Was nach Steuern und Abgaben pro Stunde übrig bleibt."
          />
          {weeklyHoursField}
        </>
      ) : (
        <>
          <TextField
            label="Netto-Monatsgehalt"
            placeholder="z. B. 2100"
            value={input.monthlyNet}
            onChangeText={(t) => set('monthlyNet', t)}
            keyboardType="decimal-pad"
            suffix="€"
            error={errors.monthlyNet}
            hint="Der Betrag, der monatlich auf deinem Konto ankommt."
          />
          {weeklyHoursField}
        </>
      )}

      <Card>
        <Checkbox
          checked={input.useFixedCosts}
          onChange={(v) => set('useFixedCosts', v)}
          label="Fixkosten abziehen (Miete, Handy, Versicherungen …)"
        />
        <Text style={styles.muted}>
          Dann zeigt die App, wie lange du für etwas arbeiten musst, wenn deine festen Kosten
          schon bezahlt sind. Das ist ehrlicher, die Zahlen werden größer.
        </Text>
        {input.useFixedCosts ? <FixedCostsEditor /> : null}
      </Card>

      {preview ? (
        <Card>
          <Text style={styles.muted}>Dein Netto-Stundenlohn</Text>
          <Text style={styles.previewValue}>{formatEuro(preview.base)}</Text>
          {preview.free != null ? (
            <Text style={styles.muted}>
              Nach Fixkosten frei verfügbar: {formatEuro(preview.free)} pro Stunde
            </Text>
          ) : null}
          {preview.fixedCostsExceedIncome ? (
            <Text style={styles.warning}>
              Deine Fixkosten sind höher als dein Einkommen. Der Rechner nutzt deshalb deinen
              normalen Stundenlohn.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
      <Button title={submitLabel} onPress={onSubmit} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  previewValue: { color: colors.text, fontSize: 28, fontWeight: '800' },
  warning: { color: colors.warning, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14 },
});
