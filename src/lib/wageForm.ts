// Prüft die Eingaben des Lohn-Formulars. Getrennt von der Oberfläche, damit testbar.

import { parseAmount } from './format';
import { LIMITS } from './wage';
import type { WageMode, WageSettings } from './wage';

export type WageFormInput = {
  wageMode: WageMode;
  hourlyWage: string;
  monthlyNet: string;
  weeklyHours: string;
  useFixedCosts: boolean;
};

export type WageFormErrors = Partial<Record<'hourlyWage' | 'monthlyNet' | 'weeklyHours', string>>;

export type WageFormResult =
  | { ok: true; values: WageSettings }
  | { ok: false; errors: WageFormErrors };

function checkRange(
  raw: string,
  limits: { min: number; max: number },
  label: string,
  unit: string,
): { value: number } | { error: string } {
  if (raw.trim() === '') return { error: `Bitte ${label} eingeben.` };
  const value = parseAmount(raw);
  if (value == null) return { error: 'Bitte eine gültige Zahl eingeben, z. B. 12,50.' };
  if (value < limits.min || value > limits.max) {
    return {
      error: `Erlaubt sind ${limits.min.toLocaleString('de-DE')} bis ${limits.max.toLocaleString('de-DE')} ${unit}.`,
    };
  }
  return { value: Math.round(value * 100) / 100 };
}

export function validateWageForm(input: WageFormInput): WageFormResult {
  const errors: WageFormErrors = {};
  let hourlyWage: number | null = null;
  let monthlyNet: number | null = null;
  let weeklyHours: number | null = null;

  const needsWeeklyHours = input.wageMode === 'monthly' || input.useFixedCosts;

  if (input.wageMode === 'hourly') {
    const r = checkRange(input.hourlyWage, LIMITS.hourlyWage, 'deinen Stundenlohn', '€');
    if ('error' in r) errors.hourlyWage = r.error;
    else hourlyWage = r.value;
  } else {
    const r = checkRange(input.monthlyNet, LIMITS.monthlyNet, 'dein Monatsnetto', '€');
    if ('error' in r) errors.monthlyNet = r.error;
    else monthlyNet = r.value;
  }

  if (needsWeeklyHours) {
    const r = checkRange(input.weeklyHours, LIMITS.weeklyHours, 'deine Wochenstunden', 'Stunden');
    if ('error' in r) errors.weeklyHours = r.error;
    else weeklyHours = r.value;
  } else if (input.weeklyHours.trim() !== '') {
    // Optional im Stundenlohn-Modus: nur übernehmen, wenn gültig
    const r = checkRange(input.weeklyHours, LIMITS.weeklyHours, 'deine Wochenstunden', 'Stunden');
    if ('error' in r) errors.weeklyHours = r.error;
    else weeklyHours = r.value;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    values: {
      wageMode: input.wageMode,
      // Der Wert des nicht gewählten Modus ist null. toProfileUpdate() lässt ihn
      // beim Speichern weg, damit ein Wechsel des Modus nichts löscht.
      hourlyWage,
      monthlyNet,
      weeklyHours,
      useFixedCosts: input.useFixedCosts,
    },
  };
}

/**
 * Macht aus geprüften Werten ein Update. Der Lohn des nicht gewählten Modus wird
 * nicht überschrieben; die Wochenstunden schon (leer = bewusst gelöscht).
 */
export function toProfileUpdate(values: WageSettings): Partial<WageSettings> {
  const update: Partial<WageSettings> = {
    wageMode: values.wageMode,
    useFixedCosts: values.useFixedCosts,
    weeklyHours: values.weeklyHours,
  };
  if (values.hourlyWage != null) update.hourlyWage = values.hourlyWage;
  if (values.monthlyNet != null) update.monthlyNet = values.monthlyNet;
  return update;
}
