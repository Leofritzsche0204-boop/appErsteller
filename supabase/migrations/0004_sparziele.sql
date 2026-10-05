-- Time is Money – Phase 3a: Sparziele
-- Ausführen im Supabase-Dashboard: SQL Editor → New query → einfügen → Run.
-- Voraussetzung: 0001 bis 0003 wurden bereits ausgeführt.
-- Das Skript kann gefahrlos mehrfach ausgeführt werden.

-- ---------------------------------------------------------------------------
-- Ziele (z. B. "Urlaub", 900 €). Die Stunden rechnet der Server aus.
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  emoji text check (emoji is null or char_length(emoji) between 1 and 8),
  target_price numeric(12, 2) not null check (target_price >= 1 and target_price <= 10000000),
  target_hours numeric(14, 4) not null,
  created_at timestamptz not null default now()
);

create index if not exists goals_owner_idx on public.goals (owner_id, created_at);

-- ---------------------------------------------------------------------------
-- Zuordnungen: gesparte Stunden, die einem Ziel zugeordnet wurden
-- ---------------------------------------------------------------------------
create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hours numeric(10, 2) not null check (hours > 0 and hours <= 10000),
  created_at timestamptz not null default now()
);

create index if not exists goal_contributions_goal_idx on public.goal_contributions (goal_id);
create index if not exists goal_contributions_user_idx on public.goal_contributions (user_id);

-- ---------------------------------------------------------------------------
-- Gesparte Stunden, die noch keinem Ziel zugeordnet sind
-- ---------------------------------------------------------------------------
create or replace function public.available_saved_hours()
returns numeric
language sql
stable
set search_path = ''
as $$
  select
    coalesce((select sum(hours) from public.items
              where user_id = auth.uid() and status = 'skipped'), 0)
    - coalesce((select sum(hours) from public.goal_contributions
                where user_id = auth.uid()), 0);
$$;

-- ---------------------------------------------------------------------------
-- Schutz: Server setzt Besitzer und Stunden, prüft verfügbare Stunden
-- ---------------------------------------------------------------------------
create or replace function public.goals_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  rate numeric;
begin
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    new.created_at := now();
  else
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
  end if;

  if tg_op = 'INSERT' or new.target_price is distinct from old.target_price then
    rate := public.effective_hourly_rate(new.owner_id);
    if rate is null or rate <= 0 then
      raise exception 'wage_not_configured';
    end if;
    new.target_hours := new.target_price / rate;
  else
    new.target_hours := old.target_hours;
  end if;
  return new;
end;
$$;

drop trigger if exists goals_before_write on public.goals;
create trigger goals_before_write
  before insert or update on public.goals
  for each row execute function public.goals_before_write();

create or replace function public.goal_contributions_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new.created_at := now();

  -- Gleichzeitige Zuordnungen desselben Nutzers nacheinander abarbeiten
  perform pg_advisory_xact_lock(hashtext('goal_contrib:' || new.user_id::text));

  if not exists (select 1 from public.goals where id = new.goal_id and owner_id = new.user_id) then
    raise exception 'goal_not_found';
  end if;

  if new.hours > public.available_saved_hours() + 0.005 then
    raise exception 'not_enough_saved_hours';
  end if;
  return new;
end;
$$;

drop trigger if exists goal_contributions_before_insert on public.goal_contributions;
create trigger goal_contributions_before_insert
  before insert on public.goal_contributions
  for each row execute function public.goal_contributions_before_insert();

-- ---------------------------------------------------------------------------
-- Zugriffsregeln
-- ---------------------------------------------------------------------------
alter table public.goals enable row level security;
alter table public.goal_contributions enable row level security;

revoke all on public.goals from anon;
revoke all on public.goal_contributions from anon;
grant select, insert, update, delete on public.goals to authenticated;
-- Zuordnungen kann man anlegen und zurücknehmen, aber nicht nachträglich ändern.
grant select, insert, delete on public.goal_contributions to authenticated;
revoke execute on function public.available_saved_hours() from public, anon;
grant execute on function public.available_saved_hours() to authenticated;

drop policy if exists "Eigene Ziele lesen" on public.goals;
create policy "Eigene Ziele lesen" on public.goals
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "Eigene Ziele anlegen" on public.goals;
create policy "Eigene Ziele anlegen" on public.goals
  for insert to authenticated with check ((select auth.uid()) = owner_id);

drop policy if exists "Eigene Ziele ändern" on public.goals;
create policy "Eigene Ziele ändern" on public.goals
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy if exists "Eigene Ziele löschen" on public.goals;
create policy "Eigene Ziele löschen" on public.goals
  for delete to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "Eigene Zuordnungen lesen" on public.goal_contributions;
create policy "Eigene Zuordnungen lesen" on public.goal_contributions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Eigene Zuordnungen anlegen" on public.goal_contributions;
create policy "Eigene Zuordnungen anlegen" on public.goal_contributions
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Eigene Zuordnungen löschen" on public.goal_contributions;
create policy "Eigene Zuordnungen löschen" on public.goal_contributions
  for delete to authenticated using ((select auth.uid()) = user_id);
