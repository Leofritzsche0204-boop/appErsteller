// Übersetzt technische Fehler in verständliche deutsche Meldungen.

type ErrorLike = { message?: unknown; code?: unknown };

export function friendlyError(error: unknown): string {
  const e = (error ?? {}) as ErrorLike;
  const message = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';

  if (/network request failed|failed to fetch|fetch failed|timeout/i.test(message)) {
    return 'Keine Verbindung zum Server. Prüfe deine Internetverbindung und versuche es erneut.';
  }
  if (code === 'anonymous_provider_disabled' || /anonymous sign-ins are disabled/i.test(message)) {
    return 'Die anonyme Anmeldung ist in Supabase noch nicht eingeschaltet (Authentication → Sign In / Providers → "Allow anonymous sign-ins").';
  }
  if (code === 'PGRST205' || code === '42P01' || /could not find the table|does not exist/i.test(message)) {
    return 'Die Datenbank ist noch nicht eingerichtet. Bitte das SQL-Skript aus supabase/migrations im Supabase SQL Editor ausführen.';
  }
  if (/wage_not_configured/.test(message)) {
    return 'Bitte richte zuerst deinen Lohn in den Einstellungen ein.';
  }
  if (/cannot_move_back_to_wishlist/.test(message)) {
    return 'Entschiedene Einträge können nicht zurück auf die Wunschliste.';
  }
  if (/not_enough_saved_hours/.test(message)) {
    return 'So viele gesparte Stunden hast du noch nicht übrig.';
  }
  if (/goal_not_found/.test(message)) {
    return 'Dieses Ziel gibt es nicht mehr.';
  }
  if (code === '23514') {
    return 'Ein Wert liegt außerhalb des erlaubten Bereichs.';
  }
  if (/rate limit|too many requests/i.test(message)) {
    return 'Zu viele Versuche in kurzer Zeit. Bitte warte kurz und versuche es erneut.';
  }
  return 'Etwas ist schiefgelaufen. Bitte versuche es erneut.';
}
