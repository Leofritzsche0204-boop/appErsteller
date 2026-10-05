// Reine Rechenfunktionen für Sparziele (ohne Datenbank, leicht testbar).

import type { Goal } from './goals';

/** Fortschritt 0–1 */
export function goalProgress(goal: Pick<Goal, 'allocatedHours' | 'targetHours'>): number {
  if (!(goal.targetHours > 0)) return 0;
  return Math.min(1, goal.allocatedHours / goal.targetHours);
}

/** Gesparte Stunden, die noch keinem Ziel zugeordnet sind (kann negativ sein,
 *  wenn ein "nicht gekauft" nachträglich auf "gekauft" geändert wurde). */
export function availableHours(totalSavedHours: number, goals: Goal[]): number {
  return totalSavedHours - goals.reduce((sum, g) => sum + g.allocatedHours, 0);
}
