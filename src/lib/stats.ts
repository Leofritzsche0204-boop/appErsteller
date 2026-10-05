// Auswertungen über die Einträge. Reine Funktionen, leicht testbar.

import type { Item } from './items';

export type PeriodSummary = {
  savedHours: number;
  spentHours: number;
  savedCount: number;
  boughtCount: number;
};

/** Gleicher Kalendermonat in lokaler Zeit? */
export function isSameMonth(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/** Summe der gesparten und ausgegebenen Stunden im laufenden Monat (nach Entscheidungsdatum). */
export function monthSummary(items: Item[], now: Date = new Date()): PeriodSummary {
  const summary: PeriodSummary = { savedHours: 0, spentHours: 0, savedCount: 0, boughtCount: 0 };
  for (const item of items) {
    if (!item.decidedAt || !isSameMonth(item.decidedAt, now)) continue;
    if (item.status === 'skipped') {
      summary.savedHours += item.hours;
      summary.savedCount += 1;
    } else if (item.status === 'bought') {
      summary.spentHours += item.hours;
      summary.boughtCount += 1;
    }
  }
  return summary;
}

export type MonthTotals = {
  /** z. B. "2026-10" */
  key: string;
  /** z. B. "Okt." */
  label: string;
  savedHours: number;
  spentHours: number;
};

const monthLabel = new Intl.DateTimeFormat('de-DE', { month: 'short' });

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Gespart / gekauft je Monat für die letzten `count` Monate, ältester zuerst. */
export function monthlyTotals(items: Item[], now: Date = new Date(), count = 6): MonthTotals[] {
  const months: MonthTotals[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: monthLabel.format(d), savedHours: 0, spentHours: 0 });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const item of items) {
    if (!item.decidedAt) continue;
    const m = byKey.get(monthKey(new Date(item.decidedAt)));
    if (!m) continue;
    if (item.status === 'skipped') m.savedHours += item.hours;
    else if (item.status === 'bought') m.spentHours += item.hours;
  }
  return months;
}

export type CategoryTotal = { category: Item['category']; hours: number };

/** Gekaufte Stunden je Kategorie im laufenden Monat, größte zuerst. */
export function categorySpent(items: Item[], now: Date = new Date()): CategoryTotal[] {
  const totals = new Map<Item['category'], number>();
  for (const item of items) {
    if (item.status !== 'bought' || !item.decidedAt || !isSameMonth(item.decidedAt, now)) continue;
    totals.set(item.category, (totals.get(item.category) ?? 0) + item.hours);
  }
  return [...totals.entries()]
    .map(([category, hours]) => ({ category, hours }))
    .sort((a, b) => b.hours - a.hours);
}

/** Insgesamt gesparte Stunden (alle geladenen Einträge). */
export function totalSavedHours(items: Item[]): number {
  return items.reduce((sum, i) => (i.status === 'skipped' ? sum + i.hours : sum), 0);
}

export type BudgetStatus = {
  budget: number;
  spent: number;
  remaining: number;
  /** Anteil verbraucht, kann über 1 liegen */
  ratio: number;
  level: 'ok' | 'warning' | 'over';
};

/** Ab 80 % Verbrauch gibt es eine Warnung. */
export const BUDGET_WARNING_RATIO = 0.8;

export function budgetStatus(spent: number, budget: number | null): BudgetStatus | null {
  if (budget == null || !(budget > 0)) return null;
  const ratio = spent / budget;
  return {
    budget,
    spent,
    remaining: budget - spent,
    ratio,
    level: ratio > 1 ? 'over' : ratio >= BUDGET_WARNING_RATIO ? 'warning' : 'ok',
  };
}
