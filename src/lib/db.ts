// Hilfsfunktionen für Werte aus der Datenbank.

/** Postgres-"numeric" kann als Text ankommen, daher immer umwandeln. */
export function toNumber(value: number | string | null): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
