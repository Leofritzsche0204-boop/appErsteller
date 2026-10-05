// Prüfregeln für E-Mail, Passwort und Code (ohne Datenbank, leicht testbar).

export const PASSWORD_MIN_LENGTH = 8;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Gibt eine Fehlermeldung zurück oder null, wenn das Passwort passt. */
export function passwordProblem(password: string, repeat: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`;
  if (!/[A-Za-zÄÖÜäöüß]/.test(password) || !/\d/.test(password)) return 'Bitte Buchstaben und Zahlen mischen.';
  if (password !== repeat) return 'Die beiden Passwörter stimmen nicht überein.';
  return null;
}

/** Code aus der E-Mail: nur Ziffern, 6 bis 10 Stellen. */
export function cleanCode(code: string): string {
  return code.replace(/\D/g, '');
}
