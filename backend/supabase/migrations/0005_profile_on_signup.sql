-- 0005_profile_on_signup.sql — the database creates each profile, together with the account.
--
-- Until now the browser created a profile after the user's first sign-in
-- (ensureOrganiserProfile in authService.ts). That had two faults:
--
--   1. A race. signIn fires onAuthStateChange before that insert ran, so the app looked the
--      profile up, found nothing, and kept "no profile" for the rest of the session.
--   2. An escalation surface. profiles_insert_own let a signed-in user insert their own
--      profile row, with only a WITH CHECK clause between them and choosing their role.
--
-- A trigger on auth.users removes both. The profile is inserted in the same transaction that
-- creates the user, so it exists before any session can, and the role is decided here —
-- server-side — never by the client.

-- ---------------------------------------------------------------------------
-- Default display name
-- ---------------------------------------------------------------------------
-- One definition shared by the trigger and the backfill below, so the two cannot drift.
-- profiles.full_name is NOT NULL: prefer a name supplied at sign-up, then the local part of
-- the email, then a placeholder for an account with neither (a phone sign-up, say).
create or replace function public.default_full_name(meta jsonb, email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(meta ->> 'full_name'), ''),
    nullif(split_part(coalesce(email, ''), '@', 1), ''),
    'New user'
  );
$$;

-- ---------------------------------------------------------------------------
-- Profile on sign-up
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because Supabase Auth inserts into auth.users as its own role, which has
-- no rights on public.profiles; the function runs as its owner instead. The empty
-- search_path is the same hygiene as every other SECURITY DEFINER function here.
--
-- If this function raises, the sign-up itself fails ("Database error saving new user"),
-- because it runs inside the transaction that creates the user. That is the right way
-- round: an account without a profile is exactly the broken state this migration removes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    public.default_full_name(new.raw_user_meta_data, new.email),
    -- Organiser is the only role with a self-service story so far. Every other role is
    -- still granted by an administrator, from the SQL editor.
    'organiser'
  );
  return new;
end;
$$;

-- Neither function is an API. Supabase grants EXECUTE on new public functions to anon and
-- authenticated explicitly, not only through PUBLIC, so all three are revoked. A trigger's
-- EXECUTE privilege is checked when the trigger is created, not each time it fires.
revoke execute on function public.default_full_name(jsonb, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------
-- Accounts created before this trigger existed may have no profile. Give each one the row
-- the trigger would have made, so nobody is left on "No organiser profile". NOT EXISTS
-- keeps the migration safe to re-run and never touches a role already assigned.
insert into public.profiles (id, full_name, role)
select u.id, public.default_full_name(u.raw_user_meta_data, u.email), 'organiser'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---------------------------------------------------------------------------
-- No client inserts profiles any more
-- ---------------------------------------------------------------------------
-- With no insert policy left, RLS denies every insert on profiles from the browser. The
-- escalation surface is closed by removing it, not by guarding it.
drop policy if exists profiles_insert_own on public.profiles;
