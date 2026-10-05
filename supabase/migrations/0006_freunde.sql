-- Time is Money – Phase 6a: Benutzername, Freunde, Rangliste
-- Ausführen im Supabase-Dashboard: SQL Editor → New query → einfügen → Run.
-- Voraussetzung: 0001 bis 0005 wurden bereits ausgeführt.
-- Das Skript kann gefahrlos mehrfach ausgeführt werden.
--
-- Datenschutz: Andere Nutzer können die Tabelle "profiles" weiterhin NICHT lesen.
-- Freunde sehen nur, was friends_list() zurückgibt: Benutzername, Emoji und
-- vom Server berechnete Kennzahlen – niemals Lohn, Euro-Beträge oder Einträge.

-- ---------------------------------------------------------------------------
-- Benutzername und Emoji im Profil
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_emoji text;

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$');

alter table public.profiles drop constraint if exists profiles_avatar_emoji_length;
alter table public.profiles add constraint profiles_avatar_emoji_length
  check (avatar_emoji is null or char_length(avatar_emoji) between 1 and 8);

-- Groß-/Kleinschreibung zählt nicht: "Leo" und "leo" sind derselbe Name
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------

-- Hat der aufrufende Nutzer ein gesichertes (nicht anonymes) Konto?
create or replace function public.is_secured_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select not u.is_anonymous from auth.users u where u.id = auth.uid()), false);
$$;

revoke execute on function public.is_secured_user() from public, anon;
grant execute on function public.is_secured_user() to authenticated;

-- Benutzername nur mit gesichertem Konto, reservierte Namen sperren
create or replace function public.profiles_check_username()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.username is distinct from old.username and new.username is not null then
    if not public.is_secured_user() then
      raise exception 'account_not_secured';
    end if;
    if lower(new.username) in ('admin', 'administrator', 'support', 'timeismoney', 'time_is_money', 'moderator', 'system') then
      raise exception 'username_reserved';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_check_username on public.profiles;
create trigger profiles_check_username
  before update on public.profiles
  for each row execute function public.profiles_check_username();

-- ---------------------------------------------------------------------------
-- Freundschaften
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> addressee_id)
);

-- Pro Paar nur eine Freundschaft, egal wer gefragt hat
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon;
-- Anlegen und Annehmen nur über die Funktionen unten; Lesen und Beenden direkt.
revoke insert, update on public.friendships from authenticated;
grant select, delete on public.friendships to authenticated;

drop policy if exists "Eigene Freundschaften lesen" on public.friendships;
create policy "Eigene Freundschaften lesen" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

drop policy if exists "Eigene Freundschaften beenden" on public.friendships;
create policy "Eigene Freundschaften beenden" on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- ---------------------------------------------------------------------------
-- Freundschaftsanfrage per Benutzername
-- Rückgabe: 'sent' (gesendet), 'accepted' (der andere hatte schon gefragt),
--           'already' (schon befreundet oder bereits angefragt)
-- ---------------------------------------------------------------------------
create or replace function public.send_friend_request(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
  existing public.friendships%rowtype;
begin
  if me is null or not public.is_secured_user() then
    raise exception 'account_not_secured';
  end if;
  if not exists (select 1 from public.profiles where id = me and username is not null) then
    raise exception 'username_required';
  end if;

  select id into target from public.profiles where lower(username) = lower(btrim(p_username));
  if target is null then
    raise exception 'username_not_found';
  end if;
  if target = me then
    raise exception 'cannot_add_self';
  end if;

  select * into existing from public.friendships
   where least(requester_id, addressee_id) = least(me, target)
     and greatest(requester_id, addressee_id) = greatest(me, target);

  if found then
    if existing.status = 'pending' and existing.addressee_id = me then
      update public.friendships set status = 'accepted', accepted_at = now() where id = existing.id;
      return 'accepted';
    end if;
    return 'already';
  end if;

  if (select count(*) from public.friendships where requester_id = me and status = 'pending') >= 50 then
    raise exception 'too_many_requests';
  end if;

  insert into public.friendships (requester_id, addressee_id) values (me, target);
  return 'sent';
end;
$$;

-- Anfrage annehmen oder ablehnen (nur der Empfänger)
create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted', accepted_at = now()
     where id = p_id and addressee_id = auth.uid() and status = 'pending';
  else
    delete from public.friendships
     where id = p_id and addressee_id = auth.uid() and status = 'pending';
  end if;
  if not found then
    raise exception 'request_not_found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Kennzahlen eines Nutzers (vom Server berechnet, nicht vom Handy)
-- Intern – nur über friends_list() erreichbar.
-- ---------------------------------------------------------------------------
create or replace function public.social_stats(p_user uuid)
returns table (
  saved_hours numeric,
  week_hours numeric,
  current_streak integer,
  best_streak integer,
  skip_count integer,
  patient_skip_count integer,
  goals_reached integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with
  tz as (select 'Europe/Berlin'::text as name),
  today as (select (now() at time zone (select name from tz))::date as d),
  start as (
    select (p.created_at at time zone (select name from tz))::date as d
    from public.profiles p where p.id = p_user
  ),
  -- Impulskauf = gekauft ohne abgelaufene Bedenkzeit
  impulses as (
    select (coalesce(i.decided_at, i.created_at) at time zone (select name from tz))::date as d
    from public.items i
    where i.user_id = p_user
      and i.status = 'bought'
      and (i.cooldown_until is null or i.decided_at is null or i.decided_at < i.cooldown_until)
  ),
  points as (
    select d from start
    union all
    select d from impulses where d >= (select d from start) - 1
  ),
  gaps as (
    select d, d - lag(d) over (order by d) as gap from points
  ),
  week_days as (
    select (i.decided_at at time zone (select name from tz))::date as d, sum(i.hours) as h
    from public.items i
    where i.user_id = p_user
      and i.counts_for_ranking
      and i.decided_at >= (date_trunc('week', now() at time zone (select name from tz)) at time zone (select name from tz))
    group by 1
  )
  select
    coalesce((select sum(hours) from public.items where user_id = p_user and status = 'skipped'), 0),
    -- Schummel-Schutz: max. 8 Std. pro Tag zählen für die Rangliste
    coalesce((select sum(least(8, h)) from week_days), 0),
    greatest(0, (select d from today) - coalesce((select max(d) from points), (select d from today))),
    greatest(
      coalesce((select max(gap) from gaps), 0),
      greatest(0, (select d from today) - coalesce((select max(d) from points), (select d from today)))
    ),
    (select count(*)::int from public.items where user_id = p_user and status = 'skipped'),
    (select count(*)::int from public.items where user_id = p_user and counts_for_ranking),
    (select count(*)::int from public.goals g
      where g.owner_id = p_user
        and coalesce((select sum(c.hours) from public.goal_contributions c where c.goal_id = g.id), 0) >= g.target_hours);
$$;

revoke execute on function public.social_stats(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Freundesliste inkl. eigener Zeile und offener Anfragen
-- relation: 'self' | 'friend' | 'incoming' | 'outgoing'
-- Kennzahlen nur für 'self' und 'friend'.
-- ---------------------------------------------------------------------------
create or replace function public.friends_list()
returns table (
  friendship_id uuid,
  user_id uuid,
  username text,
  avatar_emoji text,
  relation text,
  saved_hours numeric,
  week_hours numeric,
  current_streak integer,
  best_streak integer,
  skip_count integer,
  patient_skip_count integer,
  goals_reached integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  rel as (
    select null::uuid as friendship_id, (select id from me) as other, 'self'::text as relation
    union all
    select f.id,
           case when f.requester_id = (select id from me) then f.addressee_id else f.requester_id end,
           case
             when f.status = 'accepted' then 'friend'
             when f.addressee_id = (select id from me) then 'incoming'
             else 'outgoing'
           end
    from public.friendships f
    where (select id from me) in (f.requester_id, f.addressee_id)
  )
  select r.friendship_id, r.other, p.username, p.avatar_emoji, r.relation,
         s.saved_hours, s.week_hours, s.current_streak, s.best_streak,
         s.skip_count, s.patient_skip_count, s.goals_reached
  from rel r
  join public.profiles p on p.id = r.other
  left join lateral public.social_stats(r.other) s on r.relation in ('self', 'friend')
  where (select id from me) is not null;
$$;

revoke execute on function public.send_friend_request(text) from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.friends_list() from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.friends_list() to authenticated;
