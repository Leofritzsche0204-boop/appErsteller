-- Time is Money – Phase 1: Profil (Lohn-Einstellungen) und Fixkosten
-- Ausführen im Supabase-Dashboard: SQL Editor → New query → einfügen → Run.
-- Das Skript kann gefahrlos mehrfach ausgeführt werden.

-- ---------------------------------------------------------------------------
-- Profil: eine Zeile pro Nutzer (auch für anonyme Konten)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  wage_mode text check (wage_mode in ('hourly', 'monthly')),
  hourly_wage numeric(10, 2) check (hourly_wage is null or (hourly_wage > 0 and hourly_wage <= 1000)),
  monthly_net numeric(12, 2) check (monthly_net is null or (monthly_net > 0 and monthly_net <= 100000)),
  weekly_hours numeric(5, 2) check (weekly_hours is null or (weekly_hours > 0 and weekly_hours <= 80)),
  use_fixed_costs boolean not null default false,
  age_confirmed_at timestamptz,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Wer fertig eingerichtet ist, muss vollständige Lohn-Daten haben.
  constraint profiles_complete_when_onboarded check (
    onboarded_at is null
    or (wage_mode = 'hourly' and hourly_wage is not null)
    or (wage_mode = 'monthly' and monthly_net is not null and weekly_hours is not null)
  ),
  -- Fixkosten brauchen die Wochenstunden, um auf den Stundenlohn umzurechnen.
  constraint profiles_fixed_costs_need_hours check (
    use_fixed_costs = false or weekly_hours is not null
  )
);

-- ---------------------------------------------------------------------------
-- Fixkosten: beliebig viele Einträge pro Nutzer
-- ---------------------------------------------------------------------------
create table if not exists public.fixed_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  amount_monthly numeric(10, 2) not null check (amount_monthly > 0 and amount_monthly <= 100000),
  created_at timestamptz not null default now()
);

create index if not exists fixed_costs_user_id_idx on public.fixed_costs (user_id);

-- ---------------------------------------------------------------------------
-- updated_at automatisch setzen
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profil automatisch anlegen, sobald ein Konto entsteht (auch anonym)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Zugriffsregeln (Row Level Security): jeder sieht nur seine eigenen Daten
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.fixed_costs enable row level security;

revoke all on public.profiles from anon;
revoke all on public.fixed_costs from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.fixed_costs to authenticated;

drop policy if exists "Eigenes Profil lesen" on public.profiles;
create policy "Eigenes Profil lesen" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Eigenes Profil anlegen" on public.profiles;
create policy "Eigenes Profil anlegen" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "Eigenes Profil ändern" on public.profiles;
create policy "Eigenes Profil ändern" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Eigene Fixkosten lesen" on public.fixed_costs;
create policy "Eigene Fixkosten lesen" on public.fixed_costs
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Eigene Fixkosten anlegen" on public.fixed_costs;
create policy "Eigene Fixkosten anlegen" on public.fixed_costs
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Eigene Fixkosten ändern" on public.fixed_costs;
create policy "Eigene Fixkosten ändern" on public.fixed_costs
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Eigene Fixkosten löschen" on public.fixed_costs;
create policy "Eigene Fixkosten löschen" on public.fixed_costs
  for delete to authenticated using ((select auth.uid()) = user_id);
