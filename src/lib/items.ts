// Einträge (geprüfte Artikel) lesen und speichern.
// Stunden, Zeitstempel und Ranglisten-Flag setzt der Server (siehe 0002_eintraege.sql).

import { toNumber } from './db';
import { supabase } from './supabase';

export type ItemStatus = 'bought' | 'skipped' | 'wishlist';

export const CATEGORIES = [
  { value: 'kleidung', label: 'Kleidung', icon: '👕' },
  { value: 'elektronik', label: 'Elektronik', icon: '📱' },
  { value: 'essen', label: 'Essen & Trinken', icon: '🍔' },
  { value: 'freizeit', label: 'Freizeit', icon: '🎮' },
  { value: 'beauty', label: 'Beauty', icon: '💄' },
  { value: 'haushalt', label: 'Haushalt', icon: '🏠' },
  { value: 'sonstiges', label: 'Sonstiges', icon: '📦' },
] as const;

export type Category = (typeof CATEGORIES)[number]['value'];

export const TITLE_MAX_LENGTH = 60;

export type Item = {
  id: string;
  title: string | null;
  category: Category | null;
  price: number;
  hours: number;
  status: ItemStatus;
  cooldownUntil: string | null;
  decidedAt: string | null;
  createdAt: string;
};

type ItemRow = {
  id: string;
  title: string | null;
  category: Category | null;
  price: number | string;
  hours: number | string;
  status: ItemStatus;
  cooldown_until: string | null;
  decided_at: string | null;
  created_at: string;
};

const ITEM_COLUMNS = 'id, title, category, price, hours, status, cooldown_until, decided_at, created_at';

// Vorerst die neuesten Einträge laden; bei sehr vielen Einträgen kommt später Nachladen dazu.
const FETCH_LIMIT = 500;

function mapItem(row: ItemRow): Item {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    price: toNumber(row.price) ?? 0,
    hours: toNumber(row.hours) ?? 0,
    status: row.status,
    cooldownUntil: row.cooldown_until,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  };
}

export function categoryInfo(value: Category | null) {
  return CATEGORIES.find((c) => c.value === value) ?? null;
}

export async function fetchItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(FETCH_LIMIT)
    .overrideTypes<ItemRow[], { merge: false }>();
  if (error) throw error;
  return (data ?? []).map(mapItem);
}

export type NewItem = {
  price: number;
  status: ItemStatus;
  title?: string | null;
  category?: Category | null;
};

export async function createItem(item: NewItem): Promise<Item> {
  const title = item.title?.trim() || null;
  const { data, error } = await supabase
    .from('items')
    .insert({
      price: item.price,
      status: item.status,
      title,
      category: item.category ?? null,
    })
    .select(ITEM_COLUMNS)
    .single<ItemRow>();
  if (error) throw error;
  return mapItem(data);
}

export async function updateItemStatus(id: string, status: ItemStatus): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .update({ status })
    .eq('id', id)
    .select(ITEM_COLUMNS)
    .single<ItemRow>();
  if (error) throw error;
  return mapItem(data);
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;
}
