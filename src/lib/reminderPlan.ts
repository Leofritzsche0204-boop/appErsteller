// Welche Erinnerungen sollen eingeplant sein? Reine Funktionen, leicht testbar.

import { formatDuration } from './format';
import type { Item } from './items';
import { BUDGET_WARNING_RATIO } from './stats';

export type ReminderPrefs = {
  /** "Bedenkzeit vorbei" für Wünsche */
  cooldown: boolean;
  /** Wochenrückblick am Sonntagabend */
  weekly: boolean;
  /** Warnung bei 80 % / 100 % des Monatsbudgets */
  budget: boolean;
};

export const DEFAULT_PREFS: ReminderPrefs = { cooldown: true, weekly: true, budget: true };

export type PlannedReminder = {
  identifier: string;
  date: Date;
  title: string;
  body: string;
  url: string;
};

export const COOLDOWN_PREFIX = 'cooldown-';
export const WEEKLY_ID = 'weekly-review';
/** iOS erlaubt max. 64 geplante Benachrichtigungen pro App – wir bleiben deutlich darunter. */
export const MAX_COOLDOWN_REMINDERS = 40;

/** Eine Erinnerung pro Wunsch, dessen Bedenkzeit noch in der Zukunft endet. */
export function planCooldownReminders(items: Item[], now: number): PlannedReminder[] {
  return items
    .filter((i) => i.status === 'wishlist' && i.cooldownUntil)
    .map((i) => ({ item: i, at: new Date(i.cooldownUntil as string).getTime() }))
    .filter(({ at }) => Number.isFinite(at) && at > now + 30_000)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_COOLDOWN_REMINDERS)
    .map(({ item, at }) => {
      const question = item.title ? `Willst du „${item.title}“ immer noch?` : 'Willst du es immer noch?';
      return {
        identifier: `${COOLDOWN_PREFIX}${item.id}`,
        date: new Date(at),
        title: '⏰ Bedenkzeit vorbei',
        body: `${question} Das sind ${formatDuration(item.hours)} Arbeit.`,
        url: '/wunschliste',
      };
    });
}

export type BudgetLevel = 'warning' | 'over';

/** Hat sich durch neue Käufe die Budget-Stufe erhöht? */
export function budgetLevelCrossed(spentBefore: number, spentAfter: number, budget: number | null): BudgetLevel | null {
  if (budget == null || !(budget > 0) || !(spentAfter > spentBefore)) return null;
  const levelOf = (spent: number): number => (spent > budget ? 2 : spent >= budget * BUDGET_WARNING_RATIO ? 1 : 0);
  const before = levelOf(spentBefore);
  const after = levelOf(spentAfter);
  if (after <= before) return null;
  return after === 2 ? 'over' : 'warning';
}

/** Schlüssel, damit jede Budget-Stufe pro Monat nur einmal gemeldet wird. */
export function budgetNoticeKey(level: BudgetLevel, now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${level}`;
}
