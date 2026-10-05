// Freunde und Rangliste. Kennzahlen kommen vom Server (friends_list in 0006_freunde.sql).

import { toNumber } from './db';
import { supabase } from './supabase';

export type Relation = 'self' | 'friend' | 'incoming' | 'outgoing';

export type FriendStats = {
  savedHours: number;
  weekHours: number;
  currentStreak: number;
  bestStreak: number;
  skipCount: number;
  patientSkipCount: number;
  goalsReached: number;
};

export type FriendEntry = {
  friendshipId: string | null;
  userId: string;
  username: string | null;
  avatarEmoji: string | null;
  relation: Relation;
  /** Nur für 'self' und 'friend' */
  stats: FriendStats | null;
};

type Row = {
  friendship_id: string | null;
  user_id: string;
  username: string | null;
  avatar_emoji: string | null;
  relation: Relation;
  saved_hours: number | string | null;
  week_hours: number | string | null;
  current_streak: number | null;
  best_streak: number | null;
  skip_count: number | null;
  patient_skip_count: number | null;
  goals_reached: number | null;
};

function mapRow(r: Row): FriendEntry {
  const hasStats = r.relation === 'self' || r.relation === 'friend';
  return {
    friendshipId: r.friendship_id,
    userId: r.user_id,
    username: r.username,
    avatarEmoji: r.avatar_emoji,
    relation: r.relation,
    stats: hasStats
      ? {
          savedHours: toNumber(r.saved_hours) ?? 0,
          weekHours: toNumber(r.week_hours) ?? 0,
          currentStreak: r.current_streak ?? 0,
          bestStreak: r.best_streak ?? 0,
          skipCount: r.skip_count ?? 0,
          patientSkipCount: r.patient_skip_count ?? 0,
          goalsReached: r.goals_reached ?? 0,
        }
      : null,
  };
}

export async function fetchFriends(): Promise<FriendEntry[]> {
  const { data, error } = await supabase.rpc('friends_list');
  if (error) throw error;
  return ((data ?? []) as Row[]).map(mapRow);
}

export type SendResult = 'sent' | 'accepted' | 'already';

export async function sendFriendRequest(username: string): Promise<SendResult> {
  const { data, error } = await supabase.rpc('send_friend_request', { p_username: username.trim() });
  if (error) throw error;
  return data as SendResult;
}

export async function respondFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_friend_request', { p_id: friendshipId, p_accept: accept });
  if (error) throw error;
}

/** Freundschaft beenden oder eigene Anfrage zurückziehen. */
export async function removeFriendship(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}
