-- Time is Money – Phase 6b: Gemeinsame Sparziele (in Stunden)
-- Ausführen im Supabase-Dashboard: SQL Editor → New query → einfügen → Run.
-- Voraussetzung: 0001 bis 0006 wurden bereits ausgeführt.
-- Das Skript kann gefahrlos mehrfach ausgeführt werden.
--
-- Gemeinsame Ziele werden in Stunden gemessen, nie in Euro: so kann niemand
-- aus "Stunden ↔ Euro" den Lohn eines anderen Mitglieds ausrechnen.

-- ---------------------------------------------------------------------------
-- Ziele: gemeinsames Ziel hat ein Stunden-Ziel statt eines Euro-Preises
-- ---------------------------------------------------------------------------
alter table public.goals add column if not exists is_shared boolean not null default false;
alter table public.goals alter column target_price drop not null;

alter table public.goals drop constraint if exists goals_target_kind;
alter table public.goals add constraint goals_target_kind check (
  (is_shared and target_price is null and target_hours >= 1 and target_hours <= 10000)
  or (not is_shared and target_price is not null)
);

-- ---------------------------------------------------------------------------
-- Mitglieder gemeinsamer Ziele
-- ---------------------------------------------------------------------------
create table if not exists public.goal_members (
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('invited', 'member')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (goal_id, user_id)
);

create index if not exists goal_members_user_idx on public.goal_members (user_id);

alter table public.goal_members enable row level security;
revoke all on public.goal_members from anon, authenticated;
-- Lesen und Ändern ausschließlich über die Funktionen unten.

-- Darf der aufrufende Nutzer dieses Ziel sehen? (Besitzer, Mitglied oder eingeladen)
create or replace function public.can_see_goal(p_goal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.goals where id = p_goal and owner_id = auth.uid())
      or exists (select 1 from public.goal_members where goal_id = p_goal and user_id = auth.uid());
$$;

-- Darf der aufrufende Nutzer Stunden zuordnen? (Besitzer oder angenommenes Mitglied)
create or replace function public.can_contribute_to_goal(p_goal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.goals where id = p_goal and owner_id = auth.uid())
      or exists (select 1 from public.goal_members
                  where goal_id = p_goal and user_id = auth.uid() and status = 'member');
$$;

revoke execute on function public.can_see_goal(uuid) from public, anon;
revoke execute on function public.can_contribute_to_goal(uuid) from public, anon;
grant execute on function public.can_see_goal(uuid) to authenticated;
grant execute on function public.can_contribute_to_goal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger anpassen
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
    if new.is_shared and not public.is_secured_user() then
      raise exception 'account_not_secured';
    end if;
  else
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
    new.is_shared := old.is_shared;
  end if;

  if new.is_shared then
    -- Stunden-Ziel wird direkt angegeben, kein Euro-Betrag
    new.target_price := null;
    return new;
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

-- Besitzer eines gemeinsamen Ziels ist automatisch Mitglied
create or replace function public.goals_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_shared then
    insert into public.goal_members (goal_id, user_id, status, invited_by)
    values (new.id, new.owner_id, 'member', new.owner_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists goals_after_insert on public.goals;
create trigger goals_after_insert
  after insert on public.goals
  for each row execute function public.goals_after_insert();

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

  if not public.can_contribute_to_goal(new.goal_id) then
    raise exception 'goal_not_found';
  end if;

  if new.hours > public.available_saved_hours() + 0.005 then
    raise exception 'not_enough_saved_hours';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Zugriffsregeln: Mitglieder sehen gemeinsame Ziele und alle Beiträge daran
-- ---------------------------------------------------------------------------
drop policy if exists "Eigene Ziele lesen" on public.goals;
drop policy if exists "Sichtbare Ziele lesen" on public.goals;
create policy "Sichtbare Ziele lesen" on public.goals
  for select to authenticated using ((select auth.uid()) = owner_id or public.can_see_goal(id));

drop policy if exists "Eigene Zuordnungen lesen" on public.goal_contributions;
drop policy if exists "Zuordnungen sichtbarer Ziele lesen" on public.goal_contributions;
create policy "Zuordnungen sichtbarer Ziele lesen" on public.goal_contributions
  for select to authenticated
  using ((select auth.uid()) = user_id or public.can_contribute_to_goal(goal_id));

-- ---------------------------------------------------------------------------
-- Funktionen für Einladen, Annehmen, Verlassen und Mitgliederliste
-- ---------------------------------------------------------------------------
create or replace function public.invite_to_goal(p_goal uuid, p_friend uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not exists (select 1 from public.goals where id = p_goal and owner_id = me and is_shared) then
    raise exception 'goal_not_found';
  end if;
  if not exists (
    select 1 from public.friendships
     where status = 'accepted'
       and least(requester_id, addressee_id) = least(me, p_friend)
       and greatest(requester_id, addressee_id) = greatest(me, p_friend)
  ) then
    raise exception 'not_friends';
  end if;
  if (select count(*) from public.goal_members where goal_id = p_goal) >= 10 then
    raise exception 'goal_full';
  end if;
  insert into public.goal_members (goal_id, user_id, status, invited_by)
  values (p_goal, p_friend, 'invited', me)
  on conflict do nothing;
end;
$$;

create or replace function public.respond_goal_invite(p_goal uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_accept then
    update public.goal_members set status = 'member'
     where goal_id = p_goal and user_id = auth.uid() and status = 'invited';
  else
    delete from public.goal_members
     where goal_id = p_goal and user_id = auth.uid() and status = 'invited';
  end if;
  if not found then
    raise exception 'invite_not_found';
  end if;
end;
$$;

-- Ziel verlassen: eigene Beiträge werden wieder frei. Der Besitzer löscht stattdessen.
create or replace function public.leave_goal(p_goal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.goals where id = p_goal and owner_id = auth.uid()) then
    raise exception 'owner_cannot_leave';
  end if;
  delete from public.goal_contributions where goal_id = p_goal and user_id = auth.uid();
  delete from public.goal_members where goal_id = p_goal and user_id = auth.uid();
  if not found then
    raise exception 'goal_not_found';
  end if;
end;
$$;

-- Mitglieder aller sichtbaren gemeinsamen Ziele – nur Name, Emoji, Status, Stunden
create or replace function public.shared_goal_members()
returns table (
  goal_id uuid,
  user_id uuid,
  username text,
  avatar_emoji text,
  status text,
  hours numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.goal_id, m.user_id, p.username, p.avatar_emoji, m.status,
         coalesce((select sum(c.hours) from public.goal_contributions c
                    where c.goal_id = m.goal_id and c.user_id = m.user_id), 0)
  from public.goal_members m
  join public.profiles p on p.id = m.user_id
  where public.can_see_goal(m.goal_id);
$$;

revoke execute on function public.invite_to_goal(uuid, uuid) from public, anon;
revoke execute on function public.respond_goal_invite(uuid, boolean) from public, anon;
revoke execute on function public.leave_goal(uuid) from public, anon;
revoke execute on function public.shared_goal_members() from public, anon;
grant execute on function public.invite_to_goal(uuid, uuid) to authenticated;
grant execute on function public.respond_goal_invite(uuid, boolean) to authenticated;
grant execute on function public.leave_goal(uuid) to authenticated;
grant execute on function public.shared_goal_members() to authenticated;
