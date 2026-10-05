// Lesen und Speichern von Profil und Fixkosten in Supabase.

import { toNumber } from './db';
import { supabase } from './supabase';
import type { WageMode, WageSettings } from './wage';

export type Profile = WageSettings & {
  id: string;
  ageConfirmedAt: string | null;
  onboardedAt: string | null;
  /** Monatsbudget in Arbeitsstunden, null = kein Budget */
  monthlyBudgetHours: number | null;
  createdAt: string;
  /** Für Freunde sichtbar; null, solange noch keiner festgelegt ist */
  username: string | null;
  avatarEmoji: string | null;
};

export type FixedCost = {
  id: string;
  name: string;
  amountMonthly: number;
};

type ProfileRow = {
  id: string;
  wage_mode: WageMode | null;
  hourly_wage: number | string | null;
  monthly_net: number | string | null;
  weekly_hours: number | string | null;
  use_fixed_costs: boolean;
  age_confirmed_at: string | null;
  onboarded_at: string | null;
  monthly_budget_hours: number | string | null;
  created_at: string;
  username: string | null;
  avatar_emoji: string | null;
};

type FixedCostRow = {
  id: string;
  name: string;
  amount_monthly: number | string;
};

const PROFILE_COLUMNS =
  'id, wage_mode, hourly_wage, monthly_net, weekly_hours, use_fixed_costs, age_confirmed_at, onboarded_at, monthly_budget_hours, created_at, username, avatar_emoji';

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    wageMode: row.wage_mode ?? 'hourly',
    hourlyWage: toNumber(row.hourly_wage),
    monthlyNet: toNumber(row.monthly_net),
    weeklyHours: toNumber(row.weekly_hours),
    useFixedCosts: row.use_fixed_costs,
    ageConfirmedAt: row.age_confirmed_at,
    onboardedAt: row.onboarded_at,
    monthlyBudgetHours: toNumber(row.monthly_budget_hours),
    createdAt: row.created_at,
    username: row.username,
    avatarEmoji: row.avatar_emoji,
  };
}

/** Lädt das Profil. Fehlt es (z. B. Konto vor dem Datenbank-Update), wird es angelegt. */
export async function fetchOrCreateProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle<ProfileRow>();
  if (error) throw error;
  if (data) return mapProfile(data);

  const inserted = await supabase
    .from('profiles')
    .insert({ id: userId })
    .select(PROFILE_COLUMNS)
    .single<ProfileRow>();
  if (inserted.error) throw inserted.error;
  return mapProfile(inserted.data);
}

export type ProfileUpdate = Partial<WageSettings> & {
  ageConfirmedAt?: string;
  onboardedAt?: string;
  monthlyBudgetHours?: number | null;
  username?: string;
  avatarEmoji?: string;
};

export async function updateProfile(userId: string, update: ProfileUpdate): Promise<Profile> {
  const row: Record<string, unknown> = {};
  if (update.wageMode !== undefined) row.wage_mode = update.wageMode;
  if (update.hourlyWage !== undefined) row.hourly_wage = update.hourlyWage;
  if (update.monthlyNet !== undefined) row.monthly_net = update.monthlyNet;
  if (update.weeklyHours !== undefined) row.weekly_hours = update.weeklyHours;
  if (update.useFixedCosts !== undefined) row.use_fixed_costs = update.useFixedCosts;
  if (update.ageConfirmedAt !== undefined) row.age_confirmed_at = update.ageConfirmedAt;
  if (update.onboardedAt !== undefined) row.onboarded_at = update.onboardedAt;
  if (update.monthlyBudgetHours !== undefined) row.monthly_budget_hours = update.monthlyBudgetHours;
  if (update.username !== undefined) row.username = update.username.trim();
  if (update.avatarEmoji !== undefined) row.avatar_emoji = update.avatarEmoji;

  const { data, error } = await supabase
    .from('profiles')
    .update(row)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single<ProfileRow>();
  if (error) throw error;
  return mapProfile(data);
}

export async function fetchFixedCosts(): Promise<FixedCost[]> {
  const { data, error } = await supabase
    .from('fixed_costs')
    .select('id, name, amount_monthly')
    .order('created_at', { ascending: true })
    .overrideTypes<FixedCostRow[], { merge: false }>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    amountMonthly: toNumber(row.amount_monthly) ?? 0,
  }));
}

export async function addFixedCost(name: string, amountMonthly: number): Promise<FixedCost> {
  const { data, error } = await supabase
    .from('fixed_costs')
    .insert({ name: name.trim(), amount_monthly: amountMonthly })
    .select('id, name, amount_monthly')
    .single<FixedCostRow>();
  if (error) throw error;
  return { id: data.id, name: data.name, amountMonthly: toNumber(data.amount_monthly) ?? 0 };
}

export async function deleteFixedCost(id: string): Promise<void> {
  const { error } = await supabase.from('fixed_costs').delete().eq('id', id);
  if (error) throw error;
}
