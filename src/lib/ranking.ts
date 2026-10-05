// Rangliste unter Freunden – reine Funktion, leicht testbar.

import type { FriendEntry } from './friends';

export type RankingMode = 'week' | 'streak';

/** Rangliste aus eigener Zeile + Freunden. Gleichstand → gleicher Platz. */
export function ranking(entries: FriendEntry[], mode: RankingMode): { entry: FriendEntry; place: number; value: number }[] {
  const value = (e: FriendEntry) => (mode === 'week' ? (e.stats?.weekHours ?? 0) : (e.stats?.currentStreak ?? 0));
  const sorted = entries
    .filter((e) => e.stats && (e.relation === 'self' || e.relation === 'friend'))
    .sort((a, b) => value(b) - value(a) || (a.username ?? '').localeCompare(b.username ?? ''));
  let place = 0;
  let last: number | null = null;
  return sorted.map((entry, i) => {
    const v = value(entry);
    if (last === null || Math.abs(v - last) > 1e-9) place = i + 1;
    last = v;
    return { entry, place, value: v };
  });
}
