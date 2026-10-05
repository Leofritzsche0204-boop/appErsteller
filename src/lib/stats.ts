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
