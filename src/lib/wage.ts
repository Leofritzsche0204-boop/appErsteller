// Reine Rechenlogik: kein React, keine Datenbank. Dadurch leicht testbar.

export type WageMode = 'hourly' | 'monthly';

export type WageSettings = {
  wageMode: WageMode;
  hourlyWage: number | null;
  monthlyNet: number | null;
  weeklyHours: number | null;
  useFixedCosts: boolean;
};

// Durchschnittliche Wochen pro Monat (52 Wochen / 12 Monate).
export const WEEKS_PER_MONTH = 52 / 12;

export const LIMITS = {
  hourlyWage: { min: 1, max: 1000 },
  monthlyNet: { min: 1, max: 100000 },
  weeklyHours: { min: 1, max: 80 },
  price: { min: 0.01, max: 10000000 },
  budgetHours: { min: 1, max: 744 },
  fixedCost: { min: 0.01, max: 100000 },
} as const;

export function monthlyWorkHours(weeklyHours: number): number {
  return weeklyHours * WEEKS_PER_MONTH;
}

export type HourlyRates = {
  /** Netto-Stundenlohn */
  base: number;
  /** Stundenlohn nach Abzug der Fixkosten, null wenn nicht aktiv */
  free: number | null;
  /** true, wenn die Fixkosten das Einkommen auffressen */
  fixedCostsExceedIncome: boolean;
};

/**
 * Berechnet den Stundenlohn. Gibt null zurück, wenn die Einstellungen
 * unvollständig sind.
 */
export function computeHourlyRates(settings: WageSettings, fixedCostsTotal: number): HourlyRates | null {
  const { wageMode, hourlyWage, monthlyNet, weeklyHours, useFixedCosts } = settings;

  let base: number;
  if (wageMode === 'hourly') {
    if (!isPositive(hourlyWage)) return null;
    base = hourlyWage;
  } else {
    if (!isPositive(monthlyNet) || !isPositive(weeklyHours)) return null;
    base = monthlyNet / monthlyWorkHours(weeklyHours);
  }

  if (!useFixedCosts || !isPositive(weeklyHours) || fixedCostsTotal <= 0) {
    return { base, free: null, fixedCostsExceedIncome: false };
  }

  const hours = monthlyWorkHours(weeklyHours);
  const income = wageMode === 'monthly' && isPositive(monthlyNet) ? monthlyNet : base * hours;
  const freeIncome = income - fixedCostsTotal;
  if (freeIncome <= 0) {
    return { base, free: null, fixedCostsExceedIncome: true };
  }
  return { base, free: freeIncome / hours, fixedCostsExceedIncome: false };
}

/** Arbeitszeit in Stunden, die man für einen Preis arbeiten muss. */
export function hoursForPrice(price: number, hourlyRate: number): number {
  if (!(price > 0) || !(hourlyRate > 0)) return 0;
  return price / hourlyRate;
}

/** Arbeitstage bei gleichmäßiger 5-Tage-Woche. */
export function workDaysForHours(hours: number, weeklyHours: number | null): number | null {
  if (!isPositive(weeklyHours)) return null;
  return hours / (weeklyHours / 5);
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
