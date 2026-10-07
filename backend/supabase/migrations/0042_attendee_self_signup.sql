-- 0042_attendee_self_signup.sql — US29 (SCRUM-227): self sign-up creates Attendees.
--
-- 0005 made the database create each profile together with the account, as 'organiser'. US29
-- turns self sign-up into Attendee sign-up: AC-029.3 says it must never grant an internal role
-- or the Event Organiser role. Organisers still have a way in: they ask at sign-up, and an
-- administrator approves the request. 0005 is not edited, so a database that has applied it
-- keeps its history; this migration replaces the function and adds the request table.
--
-- Safe to re-run: every statement is create-or-replace, if-not-exists or drop-then-create, and
-- nothing here touches existing profiles (AC-029.3.13).

-- ---------------------------------------------------------------------------
-- Organiser requests
-- ---------------------------------------------------------------------------
-- A separate table rather than a flag on profiles: a request has its own lifecycle (pending,
-- then a decision with a time), and the browser can update its own profile row, so a flag
-- there would need column-level protection that a table with no write grants gets for free.
-- One row per person: the request belongs to the account, and is made once, at sign-up.
create table if not exists public.organiser_requests (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  status       text not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_at   timestamptz,

  constraint organiser_requests_status_valid
    check (status in ('pending', 'approved', 'rejected')),
  -- A decision always records when it was made, and a pending request has not been decided.
  constraint organiser_requests_decided_at_matches_status
    check ((status = 'pending') = (decided_at is null))
);

alter table public.organiser_requests enable row level security;

-- Only the trigger below writes requests, and only decide_organiser_request decides them;
-- both run as the owner. Revoking writes, not just leaving out policies, means a browser
-- attempt is refused outright (42501) instead of quietly matching no rows.
revoke all on public.organiser_requests from public, anon, authenticated;
grant select on public.organiser_requests to authenticated;

drop policy if exists organiser_requests_select_own on public.organiser_requests;
create policy organiser_requests_select_own on public.organiser_requests
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Profile on sign-up: always an Attendee
-- ---------------------------------------------------------------------------
-- raw_user_meta_data is whatever the browser sent with supabase.auth.signUp, so anyone can put
-- anything in it with dev tools. It is read for exactly two things: a display name, and
-- whether to record a request for organiser access. Neither grants anything. The role is a
-- constant here, so no value in the metadata can change it (AC-029.3).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, public.default_full_name(new.raw_user_meta_data, new.email), 'attendee');

  -- Only the exact value 'organiser' is a request. Asking for any other role records nothing:
  -- internal staff are provisioned by an administrator, not by request.
  if new.raw_user_meta_data ->> 'requested_role' = 'organiser' then
    insert into public.organiser_requests (user_id) values (new.id);
  end if;

  return new;
end;
$$;

-- As in 0005: a trigger function, not an API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Deciding a request: administrators only
-- ---------------------------------------------------------------------------
-- Run from the SQL editor or with the service role, where auth.uid() is null. That is also
-- what lets the role change past prevent_role_self_assignment (0003). There is no in-app
-- approval screen yet; administrators already assign every other role this way.
create or replace function public.decide_organiser_request(p_user_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  -- EXECUTE is revoked from browser roles below; this is the second lock, in case a later
  -- migration grants it by accident.
  if auth.uid() is not null then
    raise exception 'Organiser requests are decided by an administrator'
      using errcode = '42501';
  end if;

  if p_approve is null then
    raise exception 'Say whether the request is approved (true) or rejected (false)'
      using errcode = '22004';
  end if;

  -- FOR UPDATE: two administrators deciding at once cannot both see 'pending'.
  select status into current_status
  from public.organiser_requests
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'There is no organiser request for user %', p_user_id
      using errcode = 'P0002';
  end if;

  -- A decision is final. Reversing one is a separate administrative act on the role itself,
  -- not a second decision that would leave the request history saying something untrue.
  if current_status <> 'pending' then
    raise exception 'This organiser request was already %', current_status
      using errcode = '22000';
  end if;

  update public.organiser_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_at = now()
  where user_id = p_user_id;

  if p_approve then
    update public.profiles set role = 'organiser' where id = p_user_id;
  end if;
end;
$$;

revoke execute on function public.decide_organiser_request(uuid, boolean)
  from public, anon, authenticated;
