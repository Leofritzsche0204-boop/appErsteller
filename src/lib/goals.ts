// Sparziele und Zuordnungen lesen und speichern.
// Ziel-Stunden und Prüfung der verfügbaren Stunden macht der Server (0004_sparziele.sql).

import { toNumber } from './db';
import { supabase } from './supabase';

export const GOAL_EMOJIS = ['🏖️', '🚗', '🏠', '🎓', '💻', '🎁', '🐶', '💍', '🛟', '⭐'] as const;
export const GOAL_NAME_MAX_LENGTH = 40;

export type Contribution = { id: string; hours: number; createdAt: string };

export type Goal = {
  id: string;
  name: string;
  emoji: string | null;
  targetPrice: number;
  targetHours: number;
  createdAt: string;
  contributions: Contribution[];
  /** Summe der zugeordneten Stunden */
  allocatedHours: number;
};

type GoalRow = {
  id: string;
  name: string;
  emoji: string | null;
  target_price: number | string;
  target_hours: number | string;
  created_at: string;
  goal_contributions: { id: string; hours: number | string; created_at: string }[] | null;
};

const GOAL_COLUMNS =
  'id, name, emoji, target_price, target_hours, created_at, goal_contributions (id, hours, created_at)';

function mapGoal(row: GoalRow): Goal {
  const contributions = (row.goal_contributions ?? [])
    .map((c) => ({ id: c.id, hours: toNumber(c.hours) ?? 0, createdAt: c.created_at }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    targetPrice: toNumber(row.target_price) ?? 0,
    targetHours: toNumber(row.target_hours) ?? 0,
    createdAt: row.created_at,
    contributions,
    allocatedHours: contributions.reduce((sum, c) => sum + c.hours, 0),
  };
}

export async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select(GOAL_COLUMNS)
    .order('created_at', { ascending: true })
    .overrideTypes<GoalRow[], { merge: false }>();
  if (error) throw error;
  return (data ?? []).map(mapGoal);
}

async function fetchGoal(id: string): Promise<Goal> {
  const { data, error } = await supabase.from('goals').select(GOAL_COLUMNS).eq('id', id).single<GoalRow>();
  if (error) throw error;
  return mapGoal(data);
}

export async function createGoal(input: { name: string; emoji: string | null; targetPrice: number }): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .insert({ name: input.name.trim(), emoji: input.emoji, target_price: input.targetPrice })
    .select(GOAL_COLUMNS)
    .single<GoalRow>();
  if (error) throw error;
  return mapGoal(data);
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw error;
}

/** Ordnet Stunden zu und gibt das aktualisierte Ziel zurück. */
export async function addContribution(goalId: string, hours: number): Promise<Goal> {
  const { error } = await supabase.from('goal_contributions').insert({ goal_id: goalId, hours });
  if (error) throw error;
  return fetchGoal(goalId);
}

/** Nimmt eine Zuordnung zurück und gibt das aktualisierte Ziel zurück. */
export async function deleteContribution(goalId: string, contributionId: string): Promise<Goal> {
  const { error } = await supabase.from('goal_contributions').delete().eq('id', contributionId);
  if (error) throw error;
  return fetchGoal(goalId);
}
