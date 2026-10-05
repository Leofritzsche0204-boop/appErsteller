// Übersetzt technische Fehler in verständliche deutsche Meldungen.

type ErrorLike = { message?: unknown; code?: unknown };

/** Fehler mit einer Meldung, die direkt so angezeigt werden darf. */
export class UserFacingError extends Error {}

export function friendlyError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
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
  // Anmeldung
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return 'E-Mail oder Passwort stimmt nicht.';
  }
  if (code === 'email_exists' || code === 'user_already_exists' || /already (been )?registered/i.test(message)) {
    return 'Diese E-Mail-Adresse gehört schon zu einem Konto. Melde dich stattdessen an.';
  }
  if (code === 'otp_expired' || /token has expired or is invalid|otp.*(expired|invalid)/i.test(message)) {
    return 'Der Code ist falsch oder abgelaufen. Fordere bei Bedarf einen neuen an.';
  }
  if (code === 'weak_password' || /password should be|weak password/i.test(message)) {
    return 'Das Passwort ist zu schwach. Nimm mindestens 8 Zeichen mit Buchstaben und Zahlen.';
  }
  if (code === 'same_password' || /different from the old password/i.test(message)) {
    return 'Das neue Passwort muss sich vom alten unterscheiden.';
  }
  if (code === 'email_address_invalid' || /email address .* is invalid|invalid email/i.test(message)) {
    return 'Diese E-Mail-Adresse ist ungültig.';
  }
  if (/email rate limit|over_email_send_rate_limit/i.test(message) || code === 'over_email_send_rate_limit') {
    return 'Es wurden gerade zu viele E-Mails verschickt. Bitte warte etwas und versuche es dann erneut.';
  }
  // Freunde
  if (/account_not_secured/.test(message)) return 'Sichere zuerst dein Konto mit E-Mail und Passwort.';
  if (/username_required/.test(message)) return 'Leg zuerst einen Benutzernamen fest.';
  if (/username_not_found/.test(message)) return 'Diesen Benutzernamen gibt es nicht. Achte auf die genaue Schreibweise.';
  if (/cannot_add_self/.test(message)) return 'Das bist du selbst. 😉';
  if (/username_reserved/.test(message)) return 'Dieser Name ist reserviert.';
  if (/profiles_username_lower_idx/.test(message) || (code === '23505' && /username/.test(message))) {
    return 'Dieser Benutzername ist schon vergeben.';
  }
  if (/not_friends/.test(message)) return 'Du kannst nur Freunde einladen.';
  if (/goal_full/.test(message)) return 'Das Ziel hat schon die maximale Anzahl an Mitgliedern.';
  if (/invite_not_found/.test(message)) return 'Diese Einladung gibt es nicht mehr.';
  if (/owner_cannot_leave/.test(message)) return 'Als Ersteller kannst du das Ziel nur löschen, nicht verlassen.';
  if (/request_not_found/.test(message)) return 'Diese Anfrage gibt es nicht mehr.';
  if (/too_many_requests/.test(message)) return 'Du hast zu viele offene Anfragen. Warte, bis welche angenommen werden.';
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
