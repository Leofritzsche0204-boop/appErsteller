// Sparserie, Level und Abzeichen aus Einträgen, Zielen und Profil.

import { useCallback, useMemo } from 'react';

import { badgeStatuses, buildContext, computeStreak, levelFor, newlyUnlocked } from '../lib/achievements';
import type { Badge } from '../lib/achievements';
import { activeGoals, goalProgress } from '../lib/goalMath';
import type { Item } from '../lib/items';
import { useApp } from './AppProvider';
import { useGoals } from './GoalsProvider';
import { useItems } from './ItemsProvider';

export function useAchievements() {
  const { profile, session } = useApp();
  const { items } = useItems();
  const { goals } = useGoals();
  const createdAt = profile?.createdAt ?? new Date().toISOString();
  const goalsReached = activeGoals(goals, session?.user.id ?? null).filter((g) => goalProgress(g) >= 1).length;

  const summary = useMemo(() => {
    const streak = computeStreak(items, createdAt);
    const ctx = buildContext(items, streak, goalsReached);
    return { streak, ctx, level: levelFor(ctx.savedHours), badges: badgeStatuses(ctx) };
  }, [items, createdAt, goalsReached]);

  /** Welche Abzeichen kommen durch diese neue Liste von Einträgen dazu? */
  const badgesUnlockedBy = useCallback(
    (nextItems: Item[]): Badge[] => {
      const after = buildContext(nextItems, computeStreak(nextItems, createdAt), goalsReached);
      return newlyUnlocked(summary.ctx, after);
    },
    [createdAt, goalsReached, summary.ctx],
  );

  return { ...summary, badgesUnlockedBy };
}

/** Kurzer Text für neu freigeschaltete Abzeichen, z. B. für eine Rückmeldung. */
export function badgeMessage(badges: Badge[]): string {
  if (badges.length === 0) return '';
  return `\n🏅 Neues Abzeichen: ${badges.map((b) => `${b.icon} ${b.title}`).join(', ')}`;
}
