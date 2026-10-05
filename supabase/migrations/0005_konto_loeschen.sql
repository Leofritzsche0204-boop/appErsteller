-- Time is Money – Phase 4a: Konto löschen
-- Ausführen im Supabase-Dashboard: SQL Editor → New query → einfügen → Run.
-- Das Skript kann gefahrlos mehrfach ausgeführt werden.

-- Löscht das eigene Konto endgültig. Alle Daten (Profil, Fixkosten, Einträge,
-- Ziele, Zuordnungen) hängen per "on delete cascade" am Konto und werden mitgelöscht.
-- "security definer": läuft mit Rechten des Besitzers, darf aber nur das
-- Konto des aufrufenden Nutzers (auth.uid()) löschen.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
