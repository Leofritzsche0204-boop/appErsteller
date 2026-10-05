// Sparserie, Level und Abzeichen – reine Funktionen, aus den Einträgen berechnet.

import type { Item } from './items';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Ganze Kalendertage zwischen zwei Zeitpunkten (lokale Zeit). */
export function calendarDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS));
}

/**
 * Impulskauf = gekauft, ohne vorher die volle Bedenkzeit auf der Wunschliste
 * abgewartet zu haben.
 */
export function isImpulseBuy(item: Item): boolean {
  if (item.status !== 'bought') return false;
  if (!item.cooldownUntil || !item.decidedAt) return true;
  return new Date(item.decidedAt).getTime() < new Date(item.cooldownUntil).getTime();
}

/** Verzicht nach abgelaufener Bedenkzeit (zählt später auch für die Rangliste). */
export function isPatientSkip(item: Item): boolean {
  return (
    item.status === 'skipped' &&
    !!item.cooldownUntil &&
    !!item.decidedAt &&
    new Date(item.decidedAt).getTime() >= new Date(item.cooldownUntil).getTime()
  );
}

export type Streak = { current: number; best: number };

/**
 * Sparserie in Tagen ohne Impulskauf.
 * Start ist der Tag, an dem das Konto angelegt wurde.
 */
export function computeStreak(items: Item[], accountCreatedAt: string, now: Date = new Date()): Streak {
  const start = new Date(accountCreatedAt);
  const impulses = items
    .filter(isImpulseBuy)
    .map((i) => new Date(i.decidedAt ?? i.createdAt))
    .filter((d) => d.getTime() >= start.getTime() - DAY_MS)
    .sort((a, b) => a.getTime() - b.getTime());

  let best = 0;
  let previous = start;
  for (const d of impulses) {
    best = Math.max(best, calendarDaysBetween(previous, d));
    previous = d;
  }
  const current = calendarDaysBetween(previous, now);
  return { current, best: Math.max(best, current) };
}

// ---------------------------------------------------------------------------
// Level nach insgesamt gesparten Stunden
// ---------------------------------------------------------------------------
export const LEVELS = [
  { min: 0, name: 'Einsteiger' },
  { min: 2, name: 'Sparfuchs' },
  { min: 8, name: 'Durchblicker' },
  { min: 20, name: 'Zeitretter' },
  { min: 40, name: 'Wochenretter' },
  { min: 80, name: 'Konsum-Ninja' },
  { min: 160, name: 'Monatsretter' },
  { min: 320, name: 'Zeitmillionär' },
] as const;

export type LevelInfo = {
  level: number;
  name: string;
  /** Stunden bis zum nächsten Level, null beim höchsten Level */
  hoursToNext: number | null;
  /** Fortschritt im aktuellen Level 0–1 */
  progress: number;
};

export function levelFor(savedHours: number): LevelInfo {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (savedHours >= LEVELS[i].min) index = i;
  }
  const next = LEVELS[index + 1];
  if (!next) return { level: index + 1, name: LEVELS[index].name, hoursToNext: null, progress: 1 };
  const span = next.min - LEVELS[index].min;
  return {
    level: index + 1,
    name: LEVELS[index].name,
    hoursToNext: next.min - savedHours,
    progress: Math.min(1, Math.max(0, (savedHours - LEVELS[index].min) / span)),
  };
}

// ---------------------------------------------------------------------------
// Abzeichen
// ---------------------------------------------------------------------------
export type AchievementContext = {
  savedHours: number;
  skipCount: number;
  patientSkipCount: number;
  bestStreak: number;
  goalsReached: number;
};

export type Badge = {
  id: string;
  icon: string;
  title: string;
  description: string;
  /** aktueller Wert und Zielwert für die Fortschrittsanzeige */
  value: (ctx: AchievementContext) => number;
  target: number;
};

export const BADGES: Badge[] = [
  { id: 'first_skip', icon: '💪', title: 'Erster Sieg', description: 'Zum ersten Mal widerstanden', value: (c) => c.skipCount, target: 1 },
  { id: 'patient', icon: '😴', title: 'Drüber geschlafen', description: 'Nach Bedenkzeit verzichtet', value: (c) => c.patientSkipCount, target: 1 },
  { id: 'hours_10', icon: '⏱️', title: 'Zehn Stunden', description: '10 Std. Arbeit gespart', value: (c) => c.savedHours, target: 10 },
  { id: 'streak_7', icon: '🔥', title: 'Eine Woche stark', description: '7 Tage ohne Impulskauf', value: (c) => c.bestStreak, target: 7 },
  { id: 'skips_10', icon: '🛡️', title: 'Standhaft', description: '10× widerstanden', value: (c) => c.skipCount, target: 10 },
  { id: 'goal', icon: '🎯', title: 'Ziel erreicht', description: 'Ein Sparziel geschafft', value: (c) => c.goalsReached, target: 1 },
  { id: 'hours_40', icon: '🏖️', title: 'Eine Woche frei', description: '40 Std. Arbeit gespart', value: (c) => c.savedHours, target: 40 },
  { id: 'streak_30', icon: '🧊', title: 'Eiserner Wille', description: '30 Tage ohne Impulskauf', value: (c) => c.bestStreak, target: 30 },
  { id: 'hours_160', icon: '🏆', title: 'Ein Monat frei', description: '160 Std. Arbeit gespart', value: (c) => c.savedHours, target: 160 },
];

export type BadgeStatus = { badge: Badge; unlocked: boolean; progress: number };

export function badgeStatuses(ctx: AchievementContext): BadgeStatus[] {
  return BADGES.map((badge) => {
    const value = badge.value(ctx);
    return { badge, unlocked: value >= badge.target, progress: Math.min(1, value / badge.target) };
  });
}

export function buildContext(items: Item[], streak: Streak, goalsReached: number): AchievementContext {
  let savedHours = 0;
  let skipCount = 0;
  let patientSkipCount = 0;
  for (const item of items) {
    if (item.status !== 'skipped') continue;
    savedHours += item.hours;
    skipCount += 1;
    if (isPatientSkip(item)) patientSkipCount += 1;
  }
  return { savedHours, skipCount, patientSkipCount, bestStreak: streak.best, goalsReached };
}

/** Abzeichen, die in `after` freigeschaltet sind, in `before` aber noch nicht. */
export function newlyUnlocked(before: AchievementContext, after: AchievementContext): Badge[] {
  return BADGES.filter((b) => b.value(before) < b.target && b.value(after) >= b.target);
}
