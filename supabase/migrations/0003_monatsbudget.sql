-- Time is Money – Phase 2c: Monatsbudget in Arbeitsstunden
-- Ausführen im Supabase-Dashboard: SQL Editor → New query → einfügen → Run.
-- Voraussetzung: 0001 und 0002 wurden bereits ausgeführt.
-- Das Skript kann gefahrlos mehrfach ausgeführt werden.

alter table public.profiles
  add column if not exists monthly_budget_hours numeric(6, 2);

alter table public.profiles
  drop constraint if exists profiles_monthly_budget_hours_check;

-- Höchstens 744 Stunden (= 31 Tage × 24 Stunden), leer = kein Budget
alter table public.profiles
  add constraint profiles_monthly_budget_hours_check
  check (monthly_budget_hours is null or (monthly_budget_hours > 0 and monthly_budget_hours <= 744));
