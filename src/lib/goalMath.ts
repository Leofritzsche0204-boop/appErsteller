// Reine Rechenfunktionen für Sparziele (ohne Datenbank, leicht testbar).

import type { Contribution, Goal } from './goals';

/** Fortschritt 0–1 */
export function goalProgress(goal: Pick<Goal, 'allocatedHours' | 'targetHours'>): number {
  if (!(goal.targetHours > 0)) return 0;
  return Math.min(1, goal.allocatedHours / goal.targetHours);
}

/** Stunden, die ich selbst einem Ziel zugeordnet habe. */
export function myAllocatedHours(goal: Pick<Goal, 'contributions'>, myUserId: string | null): number {
  return goal.contributions.reduce((sum, c) => (c.userId === myUserId ? sum + c.hours : sum), 0);
}

/** Meine letzte Zuordnung zu einem Ziel (zum Zurücknehmen). */
export function myLastContribution(goal: Pick<Goal, 'contributions'>, myUserId: string | null): Contribution | null {
  const mine = goal.contributions.filter((c) => c.userId === myUserId);
  return mine[mine.length - 1] ?? null;
}

/** Gesparte Stunden, die ich noch keinem Ziel zugeordnet habe (kann negativ sein,
 *  wenn ein "nicht gekauft" nachträglich auf "gekauft" geändert wurde). */
export function availableHours(totalSavedHours: number, goals: Goal[], myUserId: string | null): number {
  return totalSavedHours - goals.reduce((sum, g) => sum + myAllocatedHours(g, myUserId), 0);
}

export type GoalRole = 'owner' | 'member' | 'invited' | null;

export function goalRole(goal: Pick<Goal, 'ownerId' | 'isShared' | 'members'>, myUserId: string | null): GoalRole {
  if (goal.ownerId === myUserId) return 'owner';
  if (!goal.isShared) return null;
  const me = goal.members.find((m) => m.userId === myUserId);
  return me ? me.status : null;
}

/** Ziele, an denen ich wirklich teilnehme (ohne offene Einladungen). */
export function activeGoals(goals: Goal[], myUserId: string | null): Goal[] {
  return goals.filter((g) => {
    const role = goalRole(g, myUserId);
    return role === 'owner' || role === 'member';
  });
}
