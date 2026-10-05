// Hilfsfunktionen für die Wunschliste mit Bedenkzeit.

import type { Item } from './items';

export const COOLDOWN_HOURS = 24;

/** Verbleibende Bedenkzeit in Millisekunden (0, wenn abgelaufen). */
export function remainingMs(item: Pick<Item, 'cooldownUntil'>, now: number): number {
  if (!item.cooldownUntil) return 0;
  const until = new Date(item.cooldownUntil).getTime();
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until - now);
}

export function isCooldownOver(item: Pick<Item, 'cooldownUntil'>, now: number): boolean {
  return remainingMs(item, now) === 0;
}

/** z. B. "noch 23 Std. 5 Min." oder "noch 4 Min." */
export function formatRemaining(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes <= 0) return 'Bedenkzeit vorbei';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `noch ${m} Min.`;
  return m === 0 ? `noch ${h} Std.` : `noch ${h} Std. ${m} Min.`;
}

/** Fortschritt der Bedenkzeit von 0 bis 1. */
export function cooldownProgress(ms: number): number {
  const total = COOLDOWN_HOURS * 60 * 60 * 1000;
  return Math.min(1, Math.max(0, 1 - ms / total));
}
