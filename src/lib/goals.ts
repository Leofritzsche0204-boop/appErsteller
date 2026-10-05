// Sparziele (privat in Euro, gemeinsam in Stunden) und Zuordnungen.
// Ziel-Stunden, Rechte und verfügbare Stunden prüft der Server
// (0004_sparziele.sql, 0007_gemeinsame_ziele.sql).

import { toNumber } from './db';
import { supabase } from './supabase';

export const GOAL_EMOJIS = ['🏖️', '🚗', '🏠', '🎓', '💻', '🎁', '🐶', '💍', '🛟', '⭐', '🎪', '🍕'] as const;
export const GOAL_NAME_MAX_LENGTH = 40;
export const SHARED_GOAL_HOURS = { min: 1, max: 10000 } as const;
export const SHARED_GOAL_MAX_MEMBERS = 10;

export type Contribution = { id: string; userId: string; hours: number; createdAt: string };

export type GoalMember = {
  userId: string;
  username: string | null;
  avatarEmoji: string | null;
  status: 'invited' | 'member';
  hours: number;
};

export type Goal = {
  id: string;
  ownerId: string;
  name: string;
  emoji: string | null;
  isShared: boolean;
  /** Nur bei privaten Zielen */
  targetPrice: number | null;
  targetHours: number;
  createdAt: string;
  /** Sichtbare Zuordnungen (bei gemeinsamen Zielen die aller Mitglieder) */
  contributions: Contribution[];
  /** Summe aller sichtbaren Zuordnungen = Fortschritt */
  allocatedHours: number;
  /** Nur bei gemeinsamen Zielen */
  members: GoalMember[];
};

type GoalRow = {
  id: string;
  owner_id: string;
  name: string;
  emoji: string | null;
  is_shared: boolean;
  target_price: number | string | null;
  target_hours: number | string;
  created_at: string;
  goal_contributions: { id: string; user_id: string; hours: number | string; created_at: string }[] | null;
};

type MemberRow = {
  goal_id: string;
  user_id: string;
  username: string | null;
  avatar_emoji: string | null;
  status: 'invited' | 'member';
  hours: number | string;
};

const GOAL_COLUMNS =
  'id, owner_id, name, emoji, is_shared, target_price, target_hours, created_at, goal_contributions (id, user_id, hours, created_at)';

function mapGoal(row: GoalRow, members: GoalMember[]): Goal {
  const contributions = (row.goal_contributions ?? [])
    .map((c) => ({ id: c.id, userId: c.user_id, hours: toNumber(c.hours) ?? 0, createdAt: c.created_at }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    emoji: row.emoji,
    isShared: row.is_shared,
    targetPrice: toNumber(row.target_price),
    targetHours: toNumber(row.target_hours) ?? 0,
    createdAt: row.created_at,
    contributions,
    allocatedHours: contributions.reduce((sum, c) => sum + c.hours, 0),
    members,
  };
}

/** Lädt alle sichtbaren Ziele inklusive Mitglieder gemeinsamer Ziele. */
export async function fetchGoals(): Promise<Goal[]> {
  const [goalsRes, membersRes] = await Promise.all([
    supabase
      .from('goals')
      .select(GOAL_COLUMNS)
      .order('created_at', { ascending: true })
      .overrideTypes<GoalRow[], { merge: false }>(),
    supabase.rpc('shared_goal_members'),
  ]);
  if (goalsRes.error) throw goalsRes.error;
  if (membersRes.error) throw membersRes.error;

  const byGoal = new Map<string, GoalMember[]>();
  for (const m of (membersRes.data ?? []) as MemberRow[]) {
    const list = byGoal.get(m.goal_id) ?? [];
    list.push({
      userId: m.user_id,
      username: m.username,
      avatarEmoji: m.avatar_emoji,
      status: m.status,
      hours: toNumber(m.hours) ?? 0,
    });
    byGoal.set(m.goal_id, list);
  }
  return (goalsRes.data ?? []).map((row) => mapGoal(row, byGoal.get(row.id) ?? []));
}

export type NewGoal =
  | { kind: 'private'; name: string; emoji: string | null; targetPrice: number }
  | { kind: 'shared'; name: string; emoji: string | null; targetHours: number };

export async function createGoal(input: NewGoal): Promise<void> {
  const row: Record<string, unknown> =
    input.kind === 'private'
      ? { name: input.name.trim(), emoji: input.emoji, target_price: input.targetPrice }
      : // target_price muss bei gemeinsamen Zielen leer sein
        { name: input.name.trim(), emoji: input.emoji, is_shared: true, target_hours: input.targetHours };
  const { error } = await supabase.from('goals').insert(row);
  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw error;
}

export async function addContribution(goalId: string, hours: number): Promise<void> {
  const { error } = await supabase.from('goal_contributions').insert({ goal_id: goalId, hours });
  if (error) throw error;
}

export async function deleteContribution(contributionId: string): Promise<void> {
  const { error } = await supabase.from('goal_contributions').delete().eq('id', contributionId);
  if (error) throw error;
}

export async function inviteToGoal(goalId: string, friendUserId: string): Promise<void> {
  const { error } = await supabase.rpc('invite_to_goal', { p_goal: goalId, p_friend: friendUserId });
  if (error) throw error;
}

export async function respondGoalInvite(goalId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_goal_invite', { p_goal: goalId, p_accept: accept });
  if (error) throw error;
}

export async function leaveGoal(goalId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_goal', { p_goal: goalId });
  if (error) throw error;
}
