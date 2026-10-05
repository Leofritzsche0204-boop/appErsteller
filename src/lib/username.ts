// Prüfregeln für Benutzernamen (gleiche Regeln wie in der Datenbank, 0006_freunde.sql).

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const AVATAR_EMOJIS = ['🦊', '🐼', '🐯', '🐸', '🦁', '🐨', '🐙', '🦄', '🐺', '🐧', '🦉', '🐢'] as const;

const RESERVED = ['admin', 'administrator', 'support', 'timeismoney', 'time_is_money', 'moderator', 'system'];

/** Fehlertext oder null, wenn der Name gültig ist. */
export function usernameProblem(name: string): string | null {
  const n = name.trim();
  if (n.length < USERNAME_MIN || n.length > USERNAME_MAX) {
    return `${USERNAME_MIN} bis ${USERNAME_MAX} Zeichen.`;
  }
  if (!/^[A-Za-z0-9_]+$/.test(n)) return 'Nur Buchstaben (ohne Umlaute), Zahlen und _ erlaubt.';
  if (RESERVED.includes(n.toLowerCase())) return 'Dieser Name ist reserviert.';
  return null;
}
