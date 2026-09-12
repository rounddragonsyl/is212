-- 0003_roles.sql — role lookup, role-aware policies, and a lock on self-assignment.
--
-- 0001 gave profiles a role column but nothing read it: the event policies key off
-- organiser_id = auth.uid(), which is a *relationship*. Core feature #1 asks for role AND
-- relationship, so this migration adds the role half and closes the escalation hole where
-- a signed-in user could simply update their own role.

-- ---------------------------------------------------------------------------
-- Reading the caller's role
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER is load-bearing, not a shortcut. A policy ON profiles that SELECTs
-- FROM profiles re-enters the same policy and Postgres fails with "infinite recursion
-- detected in policy for relation profiles". A SECURITY DEFINER function runs as its
-- owner with RLS bypassed, which breaks the cycle. This is the standard Supabase pattern
-- and the most common thing teams get wrong when adding roles.
--
-- STABLE lets the planner call it once per query instead of once per row.
-- An empty search_path stops a caller from shadowing `profiles` with their own table —
-- mandatory hygiene for any SECURITY DEFINER function.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_user_role() to authenticated;

-- ---------------------------------------------------------------------------
-- Roles are assigned, never claimed
-- ---------------------------------------------------------------------------
-- RLS alone cannot express "you may update your profile but not your role", because a
-- WITH CHECK clause sees only the new row, never the old one. A BEFORE UPDATE trigger can
-- compare the two, so that is where this rule belongs.
--
-- auth.uid() is null when the statement runs without a JWT — the SQL editor, or a
-- service-role key — so an administrator can still assign roles.
create or replace function public.prevent_role_self_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and coalesce(current_setting('app.allow_role_change', true), '') <> 'on' then
    raise exception 'Roles are assigned by an administrator, not chosen by the user'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_self_assignment on public.profiles;
create trigger profiles_prevent_role_self_assignment
  before update on public.profiles
  for each row execute function public.prevent_role_self_assignment();

-- Self-service profile creation may only ever mint an organiser. Without this, a new user
-- could insert themselves as a coordinator on first sign-in and walk straight past the
-- trigger above, which only guards UPDATE.
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'organiser');

-- ---------------------------------------------------------------------------
-- Role-aware read access
-- ---------------------------------------------------------------------------
-- Multiple permissive policies on the same action are OR-ed, so this widens access for
-- coordinators without touching the organiser's own-rows policy from 0001.
--
-- Coordinators review requests, so they read every event. Venue and technical staff are
-- deliberately not included: their access depends on being assigned to a booking, which
-- is a relationship the booking stories introduce. Granting it here would be guessing.
drop policy if exists events_select_for_coordinators on public.events;
create policy events_select_for_coordinators on public.events
  for select to authenticated
  using (public.current_user_role() = 'coordinator');

-- A coordinator reviewing a request needs to see who filed it. This is the policy that
-- would recurse without the SECURITY DEFINER function above.
drop policy if exists profiles_select_for_coordinators on public.profiles;
create policy profiles_select_for_coordinators on public.profiles
  for select to authenticated
  using (public.current_user_role() = 'coordinator');

-- ---------------------------------------------------------------------------
-- DEVELOPMENT ONLY — remove before release
-- ---------------------------------------------------------------------------
-- Lets a signed-in user switch their own role, so one test account can exercise stories
-- written for all five roles. It exists because creating five accounts to click through a
-- demo is friction we do not need in Sprint 1.
--
-- It is the exact escalation the trigger above exists to prevent, deliberately reopened
-- behind a named function that is trivial to audit and to drop:
--
--   drop function if exists public.dev_set_my_role(text);
--
-- Do that before the final release, and record it in the release checklist.
create or replace function public.dev_set_my_role(new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  -- set_config(..., true) is transaction-local, so the exemption cannot leak into any
  -- other statement in this session.
  perform set_config('app.allow_role_change', 'on', true);

  update public.profiles set role = new_role where id = auth.uid();
end;
$$;

grant execute on function public.dev_set_my_role(text) to authenticated;
