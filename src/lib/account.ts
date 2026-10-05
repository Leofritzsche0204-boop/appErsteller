// Konto sichern, anmelden, Passwort zurücksetzen, exportieren, löschen.

import { cleanCode } from './accountValidation';
import { supabase } from './supabase';

export { PASSWORD_MIN_LENGTH, cleanCode, isValidEmail, passwordProblem } from './accountValidation';

// --- Anonymes Konto sichern -------------------------------------------------

/** Schritt 1: E-Mail hinterlegen – Supabase schickt einen Bestätigungscode. */
export async function requestEmailLink(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() });
  if (error) throw error;
}

/** Schritt 2: Code aus der E-Mail bestätigen. */
export async function confirmEmailCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: cleanCode(code),
    type: 'email_change',
  });
  if (error) throw error;
}

/** Prüft beim Server, ob die E-Mail inzwischen bestätigt ist (z. B. per Link). */
export async function refreshEmailStatus(): Promise<{ email: string | null; pendingEmail: string | null }> {
  await supabase.auth.refreshSession();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return { email: data.user?.email ?? null, pendingEmail: data.user?.new_email ?? null };
}

/** Schritt 3 (und Passwort zurücksetzen): neues Passwort setzen. */
export async function setPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// --- Anmelden / Abmelden ----------------------------------------------------

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// --- Passwort vergessen -----------------------------------------------------

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) throw error;
}

/** Meldet mit dem Code aus der E-Mail an; danach kann ein neues Passwort gesetzt werden. */
export async function confirmPasswordResetCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: cleanCode(code),
    type: 'recovery',
  });
  if (error) throw error;
}

// --- Daten exportieren / Konto löschen --------------------------------------

/** Alle eigenen Daten als lesbares JSON (DSGVO: Recht auf Datenübertragbarkeit). */
export async function exportMyData(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const myId = sessionData.session?.user.id ?? '';
  const [user, profile, fixedCosts, items, goals, contributions] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('profiles').select('*').maybeSingle(),
    supabase.from('fixed_costs').select('name, amount_monthly, created_at').order('created_at'),
    supabase
      .from('items')
      .select('title, category, price, hours, status, cooldown_until, decided_at, created_at')
      .order('created_at')
      .limit(10000),
    supabase
      .from('goals')
      .select('name, emoji, is_shared, target_price, target_hours, created_at')
      .order('created_at'),
    supabase.from('goal_contributions').select('goal_id, hours, created_at').eq('user_id', myId).order('created_at'),
  ]);
  for (const r of [profile, fixedCosts, items, goals, contributions]) {
    if (r.error) throw r.error;
  }
  if (user.error) throw user.error;

  return JSON.stringify(
    {
      app: 'Time is Money',
      exportiertAm: new Date().toISOString(),
      konto: {
        id: user.data.user?.id,
        email: user.data.user?.email ?? null,
        anonym: user.data.user?.is_anonymous ?? true,
        erstelltAm: user.data.user?.created_at,
      },
      profil: profile.data,
      fixkosten: fixedCosts.data,
      eintraege: items.data,
      // Sichtbare Ziele (eigene und gemeinsame) und nur die eigenen Zuordnungen
      sparziele: goals.data,
      eigeneZuordnungen: contributions.data,
    },
    null,
    2,
  );
}

/** Löscht das eigene Konto mit allen Daten endgültig (siehe 0005_konto_loeschen.sql). */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  // Die Sitzung gehört zu einem gelöschten Konto – nur lokal abmelden.
  await supabase.auth.signOut({ scope: 'local' });
}
