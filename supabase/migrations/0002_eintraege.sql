-- Time is Money – Phase 2: Einträge (geprüfte Artikel)
-- Ausführen im Supabase-Dashboard: SQL Editor → New query → einfügen → Run.
-- Voraussetzung: 0001_profile_und_fixkosten.sql wurde bereits ausgeführt.
-- Das Skript kann gefahrlos mehrfach ausgeführt werden.

-- ---------------------------------------------------------------------------
-- Effektiver Stundenlohn eines Nutzers (gleiche Rechnung wie in der App,
-- siehe src/lib/wage.ts). Gibt null zurück, wenn der Lohn nicht eingerichtet ist.
-- ---------------------------------------------------------------------------
create or replace function public.effective_hourly_rate(p_user uuid)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  prof public.profiles%rowtype;
  base numeric;
  month_hours numeric;
  fixed_total numeric;
  income numeric;
begin
  select * into prof from public.profiles where id = p_user;
  if not found then
    return null;
  end if;

  if prof.wage_mode = 'hourly' then
    if prof.hourly_wage is null then return null; end if;
    base := prof.hourly_wage;
  elsif prof.wage_mode = 'monthly' then
    if prof.monthly_net is null or prof.weekly_hours is null then return null; end if;
    base := prof.monthly_net / (prof.weekly_hours * 52 / 12);
  else
    return null;
  end if;

  if prof.use_fixed_costs and prof.weekly_hours is not null then
    select coalesce(sum(amount_monthly), 0) into fixed_total
      from public.fixed_costs where user_id = p_user;
    if fixed_total > 0 then
      month_hours := prof.weekly_hours * 52 / 12;
      income := case when prof.wage_mode = 'monthly' then prof.monthly_net else base * month_hours end;
      -- Sind die Fixkosten höher als das Einkommen, gilt der normale Stundenlohn.
      if income - fixed_total > 0 then
        return (income - fixed_total) / month_hours;
      end if;
    end if;
  end if;

  return base;
end;
$$;

-- ---------------------------------------------------------------------------
-- Einträge
-- ---------------------------------------------------------------------------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text check (title is null or char_length(btrim(title)) between 1 and 60),
  category text check (
    category is null
    or category in ('kleidung', 'elektronik', 'essen', 'freizeit', 'beauty', 'haushalt', 'sonstiges')
  ),
  price numeric(12, 2) not null check (price >= 0.01 and price <= 10000000),
  -- Vom Server berechnet, nicht vom Handy:
  hourly_rate numeric(12, 4) not null,
  hours numeric(14, 4) not null,
  status text not null check (status in ('bought', 'skipped', 'wishlist')),
  wishlisted_at timestamptz,
  cooldown_until timestamptz,
  decided_at timestamptz,
  -- Zählt später für die Rangliste: nur "nicht gekauft" nach abgelaufener Bedenkzeit.
  counts_for_ranking boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists items_user_created_idx on public.items (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Schutz vor Manipulation: Server setzt Stunden, Zeitstempel und Ranglisten-Flag.
-- ---------------------------------------------------------------------------
create or replace function public.items_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  rate numeric;
begin
  new.user_id := auth.uid();
  new.created_at := now();

  rate := public.effective_hourly_rate(new.user_id);
  if rate is null or rate <= 0 then
    raise exception 'wage_not_configured';
  end if;
  new.hourly_rate := rate;
  new.hours := new.price / rate;

  if new.status = 'wishlist' then
    new.wishlisted_at := now();
    new.cooldown_until := now() + interval '24 hours';
    new.decided_at := null;
  else
    new.wishlisted_at := null;
    new.cooldown_until := null;
    new.decided_at := now();
  end if;
  new.counts_for_ranking := false;
  return new;
end;
$$;

create or replace function public.items_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Diese Werte dürfen nachträglich nicht geändert werden.
  new.user_id := old.user_id;
  new.price := old.price;
  new.hourly_rate := old.hourly_rate;
  new.hours := old.hours;
  new.created_at := old.created_at;
  new.wishlisted_at := old.wishlisted_at;
  new.cooldown_until := old.cooldown_until;

  if new.status = 'wishlist' and old.status <> 'wishlist' then
    raise exception 'cannot_move_back_to_wishlist';
  end if;

  if old.status = 'wishlist' and new.status <> 'wishlist' then
    new.decided_at := now();
  else
    new.decided_at := old.decided_at;
  end if;

  new.counts_for_ranking :=
    new.status = 'skipped'
    and new.wishlisted_at is not null
    and new.decided_at is not null
    and new.decided_at >= new.cooldown_until;
  return new;
end;
$$;

drop trigger if exists items_before_insert on public.items;
create trigger items_before_insert
  before insert on public.items
  for each row execute function public.items_before_insert();

drop trigger if exists items_before_update on public.items;
create trigger items_before_update
  before update on public.items
  for each row execute function public.items_before_update();

-- ---------------------------------------------------------------------------
-- Zugriffsregeln: jeder sieht und ändert nur seine eigenen Einträge
-- ---------------------------------------------------------------------------
alter table public.items enable row level security;

revoke all on public.items from anon;
grant select, insert, update, delete on public.items to authenticated;
revoke execute on function public.effective_hourly_rate(uuid) from public, anon;
grant execute on function public.effective_hourly_rate(uuid) to authenticated;

drop policy if exists "Eigene Einträge lesen" on public.items;
create policy "Eigene Einträge lesen" on public.items
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Eigene Einträge anlegen" on public.items;
create policy "Eigene Einträge anlegen" on public.items
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Eigene Einträge ändern" on public.items;
create policy "Eigene Einträge ändern" on public.items
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Eigene Einträge löschen" on public.items;
create policy "Eigene Einträge löschen" on public.items
  for delete to authenticated using ((select auth.uid()) = user_id);
